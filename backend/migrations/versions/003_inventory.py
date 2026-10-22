"""Inventory tables: batches, invoices, returns, movements.

Revision ID: 003
Revises: 002
Create Date: 2024-01-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # purchase_invoice (must be created first for FK references)
    op.create_table(
        'purchase_invoice',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('voucher_number', sa.String(50), nullable=False),
        sa.Column('supplier_invoice_number', sa.String(100), nullable=True),
        sa.Column('supplier_id', UUID(as_uuid=True), nullable=False),
        sa.Column('invoice_date', sa.Date(), nullable=False),
        sa.Column('received_date', sa.Date(), nullable=True),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('subtotal', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('discount_amount', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('tax_amount', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('total_amount', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('amount_paid', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('balance_amount', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('payment_status', sa.String(20), nullable=False, server_default='unpaid'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('attachment_path', sa.String(500), nullable=True),
        sa.Column('posted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('posted_by', UUID(as_uuid=True), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancelled_by', UUID(as_uuid=True), nullable=True),
        sa.Column('cancellation_reason', sa.Text(), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['supplier_id'], ['supplier.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['posted_by'], ['app_user.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['cancelled_by'], ['app_user.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['app_user.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_purchase_invoice_supplier', 'purchase_invoice', ['supplier_id'])
    op.create_index('ix_purchase_invoice_date', 'purchase_invoice', ['invoice_date'])
    op.create_index('ix_purchase_invoice_status', 'purchase_invoice', ['status'])
    op.create_index('ix_purchase_invoice_voucher', 'purchase_invoice', ['voucher_number'], unique=True)

    # sales_invoice (must be created before medicine_batch for FK references)
    op.create_table(
        'sales_invoice',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('invoice_number', sa.String(50), nullable=False),
        sa.Column('customer_id', UUID(as_uuid=True), nullable=False),
        sa.Column('invoice_date', sa.Date(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('subtotal', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('discount_amount', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('tax_amount', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('total_amount', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('amount_received', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('balance_amount', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('payment_status', sa.String(20), nullable=False, server_default='unpaid'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('printed_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_printed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('posted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('posted_by', UUID(as_uuid=True), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancelled_by', UUID(as_uuid=True), nullable=True),
        sa.Column('cancellation_reason', sa.Text(), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['customer_id'], ['customer.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['posted_by'], ['app_user.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['cancelled_by'], ['app_user.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['app_user.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_sales_invoice_customer', 'sales_invoice', ['customer_id'])
    op.create_index('ix_sales_invoice_date', 'sales_invoice', ['invoice_date'])
    op.create_index('ix_sales_invoice_status', 'sales_invoice', ['status'])
    op.create_index('ix_sales_invoice_number', 'sales_invoice', ['invoice_number'], unique=True)

    # medicine_batch (references purchase_invoice)
    op.create_table(
        'medicine_batch',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('medicine_id', UUID(as_uuid=True), nullable=False),
        sa.Column('batch_number', sa.String(100), nullable=False),
        sa.Column('manufacturing_date', sa.Date(), nullable=True),
        sa.Column('expiry_date', sa.Date(), nullable=False),
        sa.Column('supplier_id', UUID(as_uuid=True), nullable=True),
        sa.Column('purchase_invoice_id', UUID(as_uuid=True), nullable=True),
        sa.Column('received_quantity', sa.Numeric(18, 4), nullable=False),
        sa.Column('available_quantity', sa.Numeric(18, 4), nullable=False, server_default='0.0'),
        sa.Column('purchase_cost_per_unit', sa.Numeric(18, 4), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('location', sa.String(100), nullable=False, server_default='MAIN'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['medicine_id'], ['medicine.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['supplier_id'], ['supplier.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['purchase_invoice_id'], ['purchase_invoice.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('medicine_id', 'batch_number', 'supplier_id', name='uq_medicine_batch'),
        sa.CheckConstraint('received_quantity >= 0', name='ck_batch_received_qty_nonneg'),
        sa.CheckConstraint('available_quantity >= 0', name='ck_batch_available_qty_nonneg'),
        sa.CheckConstraint('available_quantity <= received_quantity', name='ck_batch_available_le_received'),
        sa.CheckConstraint('purchase_cost_per_unit >= 0', name='ck_batch_cost_nonneg'),
    )
    op.create_index('ix_batch_medicine', 'medicine_batch', ['medicine_id'])
    op.create_index('ix_batch_supplier', 'medicine_batch', ['supplier_id'])
    op.create_index('ix_batch_expiry_active', 'medicine_batch', ['expiry_date'], postgresql_where=sa.text("status = 'active'"))
    op.create_index('ix_batch_medicine_expiry', 'medicine_batch', ['medicine_id', 'expiry_date'])
    op.create_index('ix_batch_status', 'medicine_batch', ['status'])
    op.create_index('ix_batch_available', 'medicine_batch', ['available_quantity'], postgresql_where=sa.text("available_quantity > 0 AND status = 'active'"))

    # purchase_invoice_item
    op.create_table(
        'purchase_invoice_item',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('purchase_invoice_id', UUID(as_uuid=True), nullable=False),
        sa.Column('line_number', sa.Integer(), nullable=False),
        sa.Column('medicine_id', UUID(as_uuid=True), nullable=False),
        sa.Column('batch_number', sa.String(100), nullable=False),
        sa.Column('manufacturing_date', sa.Date(), nullable=True),
        sa.Column('expiry_date', sa.Date(), nullable=False),
        sa.Column('quantity_received', sa.Numeric(18, 4), nullable=False),
        sa.Column('purchase_unit_id', UUID(as_uuid=True), nullable=True),
        sa.Column('conversion_factor', sa.Numeric(18, 4), nullable=False, server_default='1.0'),
        sa.Column('purchase_rate', sa.Numeric(18, 4), nullable=False),
        sa.Column('discount_percent', sa.Numeric(5, 2), nullable=False, server_default='0.0'),
        sa.Column('discount_amount', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('tax_rate', sa.Numeric(5, 2), nullable=False, server_default='0.0'),
        sa.Column('tax_amount', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('line_total', sa.Numeric(18, 2), nullable=False),
        sa.Column('batch_id', UUID(as_uuid=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('quantity_base_units', sa.Numeric(18, 4), nullable=False, server_default='0.0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['purchase_invoice_id'], ['purchase_invoice.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['medicine_id'], ['medicine.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['purchase_unit_id'], ['medicine_unit.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['batch_id'], ['medicine_batch.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('purchase_invoice_id', 'line_number', name='uq_purchase_item_line'),
        sa.CheckConstraint('quantity_received > 0', name='ck_purchase_item_qty_positive'),
        sa.CheckConstraint('conversion_factor > 0', name='ck_purchase_item_conv_positive'),
        sa.CheckConstraint('purchase_rate >= 0', name='ck_purchase_item_rate_nonneg'),
    )
    op.create_index('ix_purchase_item_medicine', 'purchase_invoice_item', ['medicine_id'])
    op.create_index('ix_purchase_item_batch', 'purchase_invoice_item', ['batch_id'])
    op.create_index('ix_purchase_item_invoice', 'purchase_invoice_item', ['purchase_invoice_id'])

    # sales_invoice_item
    op.create_table(
        'sales_invoice_item',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('sales_invoice_id', UUID(as_uuid=True), nullable=False),
        sa.Column('line_number', sa.Integer(), nullable=False),
        sa.Column('medicine_id', UUID(as_uuid=True), nullable=False),
        sa.Column('batch_id', UUID(as_uuid=True), nullable=False),
        sa.Column('quantity_sold', sa.Numeric(18, 4), nullable=False),
        sa.Column('sale_unit_id', UUID(as_uuid=True), nullable=True),
        sa.Column('conversion_factor', sa.Numeric(18, 4), nullable=False, server_default='1.0'),
        sa.Column('sale_rate', sa.Numeric(18, 4), nullable=False),
        sa.Column('discount_percent', sa.Numeric(5, 2), nullable=False, server_default='0.0'),
        sa.Column('discount_amount', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('tax_rate', sa.Numeric(5, 2), nullable=False, server_default='0.0'),
        sa.Column('tax_amount', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('line_total', sa.Numeric(18, 2), nullable=False),
        sa.Column('cost_per_base_unit', sa.Numeric(18, 4), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('quantity_base_units', sa.Numeric(18, 4), nullable=False, server_default='0.0'),
        sa.Column('cogs_amount', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('gross_profit', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['sales_invoice_id'], ['sales_invoice.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['medicine_id'], ['medicine.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['batch_id'], ['medicine_batch.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['sale_unit_id'], ['medicine_unit.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('sales_invoice_id', 'line_number', name='uq_sales_item_line'),
        sa.CheckConstraint('quantity_sold > 0', name='ck_sales_item_qty_positive'),
        sa.CheckConstraint('conversion_factor > 0', name='ck_sales_item_conv_positive'),
        sa.CheckConstraint('sale_rate >= 0', name='ck_sales_item_rate_nonneg'),
        sa.CheckConstraint('cost_per_base_unit >= 0', name='ck_sales_item_cost_nonneg'),
    )
    op.create_index('ix_sales_item_medicine', 'sales_invoice_item', ['medicine_id'])
    op.create_index('ix_sales_item_batch', 'sales_invoice_item', ['batch_id'])
    op.create_index('ix_sales_item_invoice', 'sales_invoice_item', ['sales_invoice_id'])

    # purchase_return
    op.create_table(
        'purchase_return',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('return_number', sa.String(50), nullable=False),
        sa.Column('original_purchase_invoice_id', UUID(as_uuid=True), nullable=False),
        sa.Column('supplier_id', UUID(as_uuid=True), nullable=False),
        sa.Column('return_date', sa.Date(), nullable=False, server_default=sa.text('CURRENT_DATE')),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('total_amount', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('credit_note_number', sa.String(50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('posted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('posted_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['original_purchase_invoice_id'], ['purchase_invoice.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['supplier_id'], ['supplier.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['posted_by'], ['app_user.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['app_user.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_purchase_return_original', 'purchase_return', ['original_purchase_invoice_id'])
    op.create_index('ix_purchase_return_supplier', 'purchase_return', ['supplier_id'])
    op.create_index('ix_purchase_return_number', 'purchase_return', ['return_number'], unique=True)

    # purchase_return_item
    op.create_table(
        'purchase_return_item',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('purchase_return_id', UUID(as_uuid=True), nullable=False),
        sa.Column('original_purchase_item_id', UUID(as_uuid=True), nullable=False),
        sa.Column('batch_id', UUID(as_uuid=True), nullable=False),
        sa.Column('quantity_returned', sa.Numeric(18, 4), nullable=False),
        sa.Column('return_rate', sa.Numeric(18, 4), nullable=False),
        sa.Column('line_total', sa.Numeric(18, 2), nullable=False),
        sa.Column('restock_action', sa.String(20), nullable=False, server_default='quarantine'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['purchase_return_id'], ['purchase_return.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['original_purchase_item_id'], ['purchase_invoice_item.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['batch_id'], ['medicine_batch.id'], ondelete='RESTRICT'),
        sa.CheckConstraint('quantity_returned > 0', name='ck_purchase_return_item_qty_positive'),
    )
    op.create_index('ix_purchase_return_item_return', 'purchase_return_item', ['purchase_return_id'])

    # sales_return
    op.create_table(
        'sales_return',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('return_number', sa.String(50), nullable=False),
        sa.Column('original_sales_invoice_id', UUID(as_uuid=True), nullable=False),
        sa.Column('customer_id', UUID(as_uuid=True), nullable=False),
        sa.Column('return_date', sa.Date(), nullable=False, server_default=sa.text('CURRENT_DATE')),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('total_amount', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('refund_amount', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('credit_note_number', sa.String(50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('posted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('posted_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['original_sales_invoice_id'], ['sales_invoice.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['customer_id'], ['customer.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['posted_by'], ['app_user.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['app_user.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_sales_return_original', 'sales_return', ['original_sales_invoice_id'])
    op.create_index('ix_sales_return_customer', 'sales_return', ['customer_id'])
    op.create_index('ix_sales_return_number', 'sales_return', ['return_number'], unique=True)

    # sales_return_item
    op.create_table(
        'sales_return_item',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('sales_return_id', UUID(as_uuid=True), nullable=False),
        sa.Column('original_sales_item_id', UUID(as_uuid=True), nullable=False),
        sa.Column('batch_id', UUID(as_uuid=True), nullable=False),
        sa.Column('quantity_returned', sa.Numeric(18, 4), nullable=False),
        sa.Column('return_rate', sa.Numeric(18, 4), nullable=False),
        sa.Column('line_total', sa.Numeric(18, 2), nullable=False),
        sa.Column('restock_action', sa.String(20), nullable=False, server_default='quarantine'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['sales_return_id'], ['sales_return.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['original_sales_item_id'], ['sales_invoice_item.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['batch_id'], ['medicine_batch.id'], ondelete='RESTRICT'),
        sa.CheckConstraint('quantity_returned > 0', name='ck_sales_return_item_qty_positive'),
    )
    op.create_index('ix_sales_return_item_return', 'sales_return_item', ['sales_return_id'])

    # inventory_movement
    op.create_table(
        'inventory_movement',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('movement_date', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('medicine_id', UUID(as_uuid=True), nullable=False),
        sa.Column('batch_id', UUID(as_uuid=True), nullable=True),
        sa.Column('reason', sa.String(50), nullable=False),
        sa.Column('quantity_change', sa.Numeric(18, 4), nullable=False),
        sa.Column('quantity_before', sa.Numeric(18, 4), nullable=False),
        sa.Column('quantity_after', sa.Numeric(18, 4), nullable=False),
        sa.Column('unit_cost', sa.Numeric(18, 4), nullable=True),
        sa.Column('reference_type', sa.String(50), nullable=True),
        sa.Column('reference_id', UUID(as_uuid=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['medicine_id'], ['medicine.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['batch_id'], ['medicine_batch.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['app_user.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_invmov_medicine_date', 'inventory_movement', ['medicine_id', 'movement_date'])
    op.create_index('ix_invmov_batch_date', 'inventory_movement', ['batch_id', 'movement_date'])
    op.create_index('ix_invmov_reason', 'inventory_movement', ['reason'])
    op.create_index('ix_invmov_reference', 'inventory_movement', ['reference_type', 'reference_id'])

    # stock_adjustment
    op.create_table(
        'stock_adjustment',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('adjustment_number', sa.String(50), nullable=False),
        sa.Column('adjustment_date', sa.Date(), nullable=False, server_default=sa.text('CURRENT_DATE')),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('reference_type', sa.String(50), nullable=True),
        sa.Column('reference_id', UUID(as_uuid=True), nullable=True),
        sa.Column('total_items', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_value_change', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('posted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('posted_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['posted_by'], ['app_user.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['app_user.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_stock_adjustment_number', 'stock_adjustment', ['adjustment_number'], unique=True)

    # stock_adjustment_item
    op.create_table(
        'stock_adjustment_item',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('stock_adjustment_id', UUID(as_uuid=True), nullable=False),
        sa.Column('medicine_id', UUID(as_uuid=True), nullable=False),
        sa.Column('batch_id', UUID(as_uuid=True), nullable=True),
        sa.Column('quantity_change', sa.Numeric(18, 4), nullable=False),
        sa.Column('unit_cost', sa.Numeric(18, 4), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('value_change', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['stock_adjustment_id'], ['stock_adjustment.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['medicine_id'], ['medicine.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['batch_id'], ['medicine_batch.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_stock_adjustment_item_adj', 'stock_adjustment_item', ['stock_adjustment_id'])


def downgrade() -> None:
    op.drop_index('ix_stock_adjustment_item_adj', table_name='stock_adjustment_item')
    op.drop_table('stock_adjustment_item')
    op.drop_index('ix_stock_adjustment_number', table_name='stock_adjustment')
    op.drop_table('stock_adjustment')
    
    op.drop_index('ix_invmov_reference', table_name='inventory_movement')
    op.drop_index('ix_invmov_reason', table_name='inventory_movement')
    op.drop_index('ix_invmov_batch_date', table_name='inventory_movement')
    op.drop_index('ix_invmov_medicine_date', table_name='inventory_movement')
    op.drop_table('inventory_movement')
    
    op.drop_index('ix_sales_return_item_return', table_name='sales_return_item')
    op.drop_table('sales_return_item')
    op.drop_index('ix_sales_return_number', table_name='sales_return')
    op.drop_index('ix_sales_return_customer', table_name='sales_return')
    op.drop_index('ix_sales_return_original', table_name='sales_return')
    op.drop_table('sales_return')
    
    op.drop_index('ix_purchase_return_item_return', table_name='purchase_return_item')
    op.drop_table('purchase_return_item')
    op.drop_index('ix_purchase_return_number', table_name='purchase_return')
    op.drop_index('ix_purchase_return_supplier', table_name='purchase_return')
    op.drop_index('ix_purchase_return_original', table_name='purchase_return')
    op.drop_table('purchase_return')
    
    op.drop_index('ix_sales_item_invoice', table_name='sales_invoice_item')
    op.drop_index('ix_sales_item_batch', table_name='sales_invoice_item')
    op.drop_index('ix_sales_item_medicine', table_name='sales_invoice_item')
    op.drop_table('sales_invoice_item')
    op.drop_index('ix_sales_invoice_number', table_name='sales_invoice')
    op.drop_index('ix_sales_invoice_status', table_name='sales_invoice')
    op.drop_index('ix_sales_invoice_date', table_name='sales_invoice')
    op.drop_index('ix_sales_invoice_customer', table_name='sales_invoice')
    op.drop_table('sales_invoice')
    
    op.drop_index('ix_purchase_item_invoice', table_name='purchase_invoice_item')
    op.drop_index('ix_purchase_item_batch', table_name='purchase_invoice_item')
    op.drop_index('ix_purchase_item_medicine', table_name='purchase_invoice_item')
    op.drop_table('purchase_invoice_item')
    op.drop_index('ix_purchase_invoice_voucher', table_name='purchase_invoice')
    op.drop_index('ix_purchase_invoice_status', table_name='purchase_invoice')
    op.drop_index('ix_purchase_invoice_date', table_name='purchase_invoice')
    op.drop_index('ix_purchase_invoice_supplier', table_name='purchase_invoice')
    op.drop_table('purchase_invoice')
    
    op.drop_index('ix_batch_available', table_name='medicine_batch')
    op.drop_index('ix_batch_status', table_name='medicine_batch')
    op.drop_index('ix_batch_medicine_expiry', table_name='medicine_batch')
    op.drop_index('ix_batch_expiry_active', table_name='medicine_batch')
    op.drop_index('ix_batch_supplier', table_name='medicine_batch')
    op.drop_index('ix_batch_medicine', table_name='medicine_batch')
    op.drop_table('medicine_batch')