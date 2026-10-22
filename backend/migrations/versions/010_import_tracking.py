"""Import tracking and historical sales performance tables.

Revision ID: 010
Revises: 009
Create Date: 2026-10-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'import_batch',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('source_file', sa.String(500), nullable=False),
        sa.Column('source_sheet', sa.String(100), nullable=True),
        sa.Column('import_type', sa.String(30), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='completed'),
        sa.Column('rows_total', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('rows_imported', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('rows_skipped', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('rows_failed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('summary', sa.JSON(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['created_by'], ['app_user.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_import_batch_type', 'import_batch', ['import_type'])
    op.create_index('ix_import_batch_created', 'import_batch', ['created_at'])

    op.create_table(
        'imported_sales_history',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('import_batch_id', UUID(as_uuid=True), nullable=False),
        sa.Column('period_year', sa.Integer(), nullable=False),
        sa.Column('period_month', sa.Integer(), nullable=False),
        sa.Column('product_name', sa.String(200), nullable=False),
        sa.Column('product_code', sa.String(50), nullable=True),
        sa.Column('quantity_sold', sa.Numeric(18, 4), nullable=False, server_default='0'),
        sa.Column('sale_amount', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('purchase_quantity', sa.Numeric(18, 4), nullable=False, server_default='0'),
        sa.Column('purchase_amount', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('profit_amount', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('balance_quantity', sa.Numeric(18, 4), nullable=False, server_default='0'),
        sa.Column('source_row', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['import_batch_id'], ['import_batch.id'], ondelete='CASCADE'),
        sa.UniqueConstraint(
            'period_year', 'period_month', 'product_name',
            name='uq_imported_sales_month_product',
        ),
        sa.CheckConstraint('period_month >= 1 AND period_month <= 12', name='ck_ish_month_range'),
    )
    op.create_index('ix_imported_sales_period', 'imported_sales_history', ['period_year', 'period_month'])
    op.create_index('ix_imported_sales_product', 'imported_sales_history', ['product_name'])

    op.create_table(
        'imported_month_summary',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('import_batch_id', UUID(as_uuid=True), nullable=False),
        sa.Column('period_year', sa.Integer(), nullable=False),
        sa.Column('period_month', sa.Integer(), nullable=False),
        sa.Column('total_sales', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('total_purchase', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('total_purchase_out', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('total_profit', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('total_discount', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('total_expense', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('closing_balance_units', sa.Numeric(18, 4), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['import_batch_id'], ['import_batch.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('period_year', 'period_month', name='uq_imported_month_summary'),
        sa.CheckConstraint('period_month >= 1 AND period_month <= 12', name='ck_ims_month_range'),
    )

    op.create_table(
        'imported_customer_performance',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('import_batch_id', UUID(as_uuid=True), nullable=False),
        sa.Column('customer_id', UUID(as_uuid=True), nullable=True),
        sa.Column('customer_name', sa.String(200), nullable=False),
        sa.Column('period_year', sa.Integer(), nullable=False),
        sa.Column('period_month', sa.Integer(), nullable=False),
        sa.Column('actual_sales', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('source', sa.String(30), nullable=False, server_default='roi'),
        sa.Column('source_row', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['import_batch_id'], ['import_batch.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['customer_id'], ['customer.id'], ondelete='SET NULL'),
        sa.UniqueConstraint(
            'customer_name', 'period_year', 'period_month', 'source',
            name='uq_imported_customer_perf',
        ),
        sa.CheckConstraint('period_month >= 1 AND period_month <= 12', name='ck_icp_month_range'),
    )
    op.create_index('ix_imported_customer_period', 'imported_customer_performance', ['period_year', 'period_month'])


def downgrade() -> None:
    op.drop_table('imported_customer_performance')
    op.drop_table('imported_month_summary')
    op.drop_table('imported_sales_history')
    op.drop_table('import_batch')
