"""Reporting views.

Revision ID: 007
Revises: 006
Create Date: 2024-01-15
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # v_current_stock - Saleable stock with expiry status
    op.execute("""
        CREATE OR REPLACE VIEW v_current_stock AS
        SELECT
            m.id AS medicine_id,
            m.product_code,
            m.name AS medicine_name,
            m.generic_name,
            m.strength,
            m.dosage_form,
            man.name AS manufacturer,
            mb.id AS batch_id,
            mb.batch_number,
            mb.manufacturing_date,
            mb.expiry_date,
            mb.available_quantity,
            mb.purchase_cost_per_unit,
            (mb.available_quantity * mb.purchase_cost_per_unit) AS stock_value,
            s.name AS supplier_name,
            CASE
                WHEN mb.expiry_date < CURRENT_DATE THEN 'expired'
                WHEN mb.expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'critical'
                WHEN mb.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_30'
                WHEN mb.expiry_date <= CURRENT_DATE + INTERVAL '60 days' THEN 'expiring_60'
                WHEN mb.expiry_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'expiring_90'
                ELSE 'ok'
            END AS expiry_status,
            mb.location,
            mb.status
        FROM medicine_batch mb
        JOIN medicine m ON m.id = mb.medicine_id
        LEFT JOIN manufacturer man ON man.id = m.manufacturer_id
        LEFT JOIN supplier s ON s.id = mb.supplier_id
        WHERE mb.status = 'active' AND mb.available_quantity > 0
        ORDER BY mb.expiry_date ASC, m.name;
    """)

    # v_customer_outstanding - Customer receivables
    op.execute("""
        CREATE OR REPLACE VIEW v_customer_outstanding AS
        SELECT
            c.id AS customer_id,
            c.name,
            c.customer_type,
            c.specialty,
            c.area,
            c.credit_limit,
            COALESCE(SUM(
                CASE
                    WHEN si.status = 'posted' THEN si.balance_amount
                    ELSE 0
                END
            ), 0) AS total_outstanding,
            COALESCE(SUM(
                CASE
                    WHEN si.status = 'posted' AND si.due_date < CURRENT_DATE AND si.balance_amount > 0 THEN si.balance_amount
                    ELSE 0
                END
            ), 0) AS overdue_amount,
            MAX(si.invoice_date) AS last_invoice_date,
            COUNT(CASE WHEN si.status = 'posted' AND si.balance_amount > 0 THEN 1 END) AS pending_invoices
        FROM customer c
        LEFT JOIN sales_invoice si ON si.customer_id = c.id
        WHERE c.is_active
        GROUP BY c.id, c.name, c.customer_type, c.specialty, c.area, c.credit_limit;
    """)

    # v_supplier_outstanding - Supplier payables
    op.execute("""
        CREATE OR REPLACE VIEW v_supplier_outstanding AS
        SELECT
            s.id AS supplier_id,
            s.name,
            COALESCE(SUM(
                CASE
                    WHEN pi.status = 'posted' THEN pi.balance_amount
                    ELSE 0
                END
            ), 0) AS total_payable,
            COALESCE(SUM(
                CASE
                    WHEN pi.status = 'posted' AND pi.due_date < CURRENT_DATE AND pi.balance_amount > 0 THEN pi.balance_amount
                    ELSE 0
                END
            ), 0) AS overdue_amount,
            MAX(pi.invoice_date) AS last_invoice_date,
            COUNT(CASE WHEN pi.status = 'posted' AND pi.balance_amount > 0 THEN 1 END) AS pending_invoices
        FROM supplier s
        LEFT JOIN purchase_invoice pi ON pi.supplier_id = s.id
        WHERE s.is_active
        GROUP BY s.id, s.name;
    """)

    # v_gross_profit - Monthly gross profit by medicine
    op.execute("""
        CREATE OR REPLACE VIEW v_gross_profit AS
        SELECT
            DATE_TRUNC('month', si.invoice_date)::DATE AS month_start,
            m.id AS medicine_id,
            m.name AS medicine_name,
            SUM(sii.quantity_base_units) AS units_sold,
            SUM(sii.line_total) AS revenue,
            SUM(sii.cogs_amount) AS cogs,
            SUM(sii.gross_profit) AS gross_profit,
            CASE WHEN SUM(sii.line_total) > 0
                 THEN ROUND((SUM(sii.gross_profit) / SUM(sii.line_total)) * 100, 2)
                 ELSE 0 END AS gross_margin_pct
        FROM sales_invoice si
        JOIN sales_invoice_item sii ON sii.sales_invoice_id = si.id
        JOIN medicine m ON m.id = sii.medicine_id
        WHERE si.status = 'posted'
        GROUP BY DATE_TRUNC('month', si.invoice_date), m.id, m.name
        ORDER BY month_start DESC, gross_profit DESC;
    """)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_gross_profit")
    op.execute("DROP VIEW IF EXISTS v_supplier_outstanding")
    op.execute("DROP VIEW IF EXISTS v_customer_outstanding")
    op.execute("DROP VIEW IF EXISTS v_current_stock")