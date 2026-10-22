"""Doctor investment transactions and sales targets schema additions.

Revision ID: 009
Revises: 008
Create Date: 2026-10-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # investment_transaction
    op.create_table(
        'investment_transaction',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('investment_id', UUID(as_uuid=True), nullable=False),
        sa.Column('transaction_type', sa.String(30), nullable=False),  # disbursement, recovery, adjustment, write_off, reversal
        sa.Column('amount', sa.Numeric(18, 2), nullable=False),
        sa.Column('transaction_date', sa.Date(), nullable=False),
        sa.Column('payment_method', sa.String(30), nullable=False, server_default='cash'),
        sa.Column('account_id', UUID(as_uuid=True), nullable=True),
        sa.Column('reference_number', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['investment_id'], ['doctor_investment.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['account_id'], ['financial_account.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['app_user.id'], ondelete='SET NULL'),
        sa.CheckConstraint('amount >= 0', name='ck_investment_tx_amount_nonneg'),
    )
    op.create_index('ix_investment_tx_investment', 'investment_transaction', ['investment_id'])
    op.create_index('ix_investment_tx_date', 'investment_transaction', ['transaction_date'])
    op.create_index('ix_investment_tx_type', 'investment_transaction', ['transaction_type'])

    # sales_target
    op.create_table(
        'sales_target',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('customer_id', UUID(as_uuid=True), nullable=False),
        sa.Column('target_year', sa.Integer(), nullable=False),
        sa.Column('target_month', sa.Integer(), nullable=False),
        sa.Column('target_amount', sa.Numeric(18, 2), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['customer_id'], ['customer.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['app_user.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('customer_id', 'target_year', 'target_month', name='uq_customer_target_month'),
        sa.CheckConstraint('target_month >= 1 AND target_month <= 12', name='ck_target_month_range'),
        sa.CheckConstraint('target_amount >= 0', name='ck_target_amount_nonneg'),
    )
    op.create_index('ix_sales_target_customer', 'sales_target', ['customer_id'])

    # sales_attribution
    op.create_table(
        'sales_attribution',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('sales_invoice_id', UUID(as_uuid=True), nullable=False),
        sa.Column('customer_id', UUID(as_uuid=True), nullable=False),
        sa.Column('attributed_amount', sa.Numeric(18, 2), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['sales_invoice_id'], ['sales_invoice.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['customer_id'], ['customer.id'], ondelete='CASCADE'),
        sa.CheckConstraint('attributed_amount >= 0', name='ck_sales_attribution_amount_nonneg'),
    )
    op.create_index('ix_sales_attribution_invoice', 'sales_attribution', ['sales_invoice_id'])
    op.create_index('ix_sales_attribution_customer', 'sales_attribution', ['customer_id'])


def downgrade() -> None:
    op.drop_table('sales_attribution')
    op.drop_table('sales_target')
    op.drop_table('investment_transaction')
