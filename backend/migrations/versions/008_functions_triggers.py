"""Database functions and triggers.

Revision ID: 008
Revises: 007
Create Date: 2024-01-15
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Function: Get next voucher number
    op.execute("""
        CREATE OR REPLACE FUNCTION get_next_voucher_number(p_prefix VARCHAR, p_fy INT)
        RETURNS VARCHAR AS $$
        DECLARE
            v_seq INT;
            v_result VARCHAR;
            v_template VARCHAR;
        BEGIN
            UPDATE number_sequence
            SET current_sequence = current_sequence + 1,
                updated_at = now()
            WHERE prefix = p_prefix AND financial_year = p_fy
            RETURNING current_sequence INTO v_seq;
            
            IF NOT FOUND THEN
                INSERT INTO number_sequence (prefix, current_sequence, financial_year)
                VALUES (p_prefix, 1, p_fy)
                RETURNING current_sequence INTO v_seq;
            END IF;
            
            SELECT format_template INTO v_template
            FROM number_sequence
            WHERE prefix = p_prefix AND financial_year = p_fy;
            
            v_result := REPLACE(REPLACE(v_template, '{PREFIX}', p_prefix), '{YEAR}', p_fy::VARCHAR);
            v_result := REPLACE(v_result, '{SEQ:06d}', LPAD(v_seq::VARCHAR, 6, '0'));
            
            RETURN v_result;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Function: Recalculate account balance
    op.execute("""
        CREATE OR REPLACE FUNCTION recalculate_account_balance(p_account_id UUID)
        RETURNS NUMERIC AS $$
        DECLARE
            v_balance NUMERIC(18,2);
        BEGIN
            SELECT opening_balance + COALESCE(SUM(
                CASE WHEN jel.entry_type = 'credit' THEN jel.amount ELSE -jel.amount END
            ), 0)
            INTO v_balance
            FROM financial_account fa
            LEFT JOIN journal_entry_line jel ON jel.account_id = fa.id
            LEFT JOIN journal_entry je ON je.id = jel.journal_entry_id AND je.status = 'posted'
            WHERE fa.id = p_account_id;
            
            RETURN v_balance;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Function: Update batch available quantity
    op.execute("""
        CREATE OR REPLACE FUNCTION update_batch_availability(
            p_batch_id UUID,
            p_qty_change NUMERIC,
            p_reason VARCHAR,
            p_reference_type VARCHAR,
            p_reference_id UUID,
            p_unit_cost NUMERIC,
            p_user_id UUID
        ) RETURNS VOID AS $$
        DECLARE
            v_qty_before NUMERIC(18,4);
            v_qty_after NUMERIC(18,4);
            v_medicine_id UUID;
        BEGIN
            -- Lock the batch row
            SELECT available_quantity, medicine_id INTO v_qty_before, v_medicine_id
            FROM medicine_batch
            WHERE id = p_batch_id
            FOR UPDATE;
            
            v_qty_after := v_qty_before + p_qty_change;
            
            IF v_qty_after < 0 THEN
                RAISE EXCEPTION 'Insufficient stock in batch %: requested change %, available %', 
                    p_batch_id, p_qty_change, v_qty_before;
            END IF;
            
            -- Update batch
            UPDATE medicine_batch
            SET available_quantity = v_qty_after,
                updated_at = now()
            WHERE id = p_batch_id;
            
            -- Record movement
            INSERT INTO inventory_movement (
                medicine_id, batch_id, reason, quantity_change,
                quantity_before, quantity_after, unit_cost,
                reference_type, reference_id, created_by
            ) VALUES (
                v_medicine_id, p_batch_id, p_reason, p_qty_change,
                v_qty_before, v_qty_after, p_unit_cost,
                p_reference_type, p_reference_id, p_user_id
            );
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Function: Get FEFO batches for sale
    op.execute("""
        CREATE OR REPLACE FUNCTION get_fefo_batches(
            p_medicine_id UUID,
            p_qty_needed NUMERIC,
            p_sale_date DATE
        ) RETURNS TABLE (
            batch_id UUID,
            batch_number VARCHAR,
            expiry_date DATE,
            available_qty NUMERIC,
            cost_per_unit NUMERIC,
            allocate_qty NUMERIC
        ) AS $$
        DECLARE
            v_remaining NUMERIC := p_qty_needed;
            v_batch RECORD;
        BEGIN
            FOR v_batch IN
                SELECT id, batch_number, expiry_date, available_quantity, purchase_cost_per_unit
                FROM medicine_batch
                WHERE medicine_id = p_medicine_id
                  AND status = 'active'
                  AND available_quantity > 0
                  AND expiry_date >= p_sale_date
                ORDER BY expiry_date ASC, manufacturing_date ASC NULLS FIRST, id ASC
                FOR UPDATE
            LOOP
                IF v_remaining <= 0 THEN
                    EXIT;
                END IF;
                
                allocate_qty := LEAST(v_remaining, v_batch.available_quantity);
                v_remaining := v_remaining - allocate_qty;
                
                RETURN NEXT;
            END LOOP;
            
            IF v_remaining > 0 THEN
                RAISE EXCEPTION 'Insufficient stock for medicine %: % units short', p_medicine_id, v_remaining;
            END IF;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Trigger: Prevent modification of inventory_movement
    op.execute("""
        CREATE OR REPLACE FUNCTION prevent_inventory_movement_modification()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'Inventory movements are immutable and cannot be modified';
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER trg_inventory_movement_immutable
        BEFORE UPDATE OR DELETE ON inventory_movement
        FOR EACH ROW EXECUTE FUNCTION prevent_inventory_movement_modification();
    """)

    # Trigger: Auto-update updated_at timestamp
    op.execute("""
        -- Apply updated_at trigger to all tables with updated_at column
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        DO $$
        DECLARE
            tbl RECORD;
        BEGIN
            FOR tbl IN
                SELECT table_name
                FROM information_schema.columns
                WHERE column_name = 'updated_at'
                AND table_schema = 'public'
                AND table_name NOT IN ('inventory_movement', 'audit_log', 'application_setting')
            LOOP
                EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON %I', tbl.table_name);
                EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', tbl.table_name);
            END LOOP;
        END $$;
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_inventory_movement_immutable ON inventory_movement")
    op.execute("DROP FUNCTION IF EXISTS prevent_inventory_movement_modification()")
    op.execute("DROP FUNCTION IF EXISTS get_fefo_batches")
    op.execute("DROP FUNCTION IF EXISTS update_batch_availability")
    op.execute("DROP FUNCTION IF EXISTS recalculate_account_balance")
    op.execute("DROP FUNCTION IF EXISTS get_next_voucher_number")
    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column")
    
    op.execute("""
        -- Drop updated_at triggers
        DO $$
        DECLARE
            tbl RECORD;
        BEGIN
            FOR tbl IN
                SELECT table_name
                FROM information_schema.columns
                WHERE column_name = 'updated_at'
                AND table_schema = 'public'
            LOOP
                EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON %I', tbl.table_name);
            END LOOP;
        END $$;
    """)