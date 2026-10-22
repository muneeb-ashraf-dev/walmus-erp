"""Initial migration: enums and core tables.

Revision ID: 001
Revises: 
Create Date: 2024-01-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ENUM

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum types
    invoice_status = ENUM(
        'draft', 'posted', 'cancelled', 'partially_returned', 'fully_returned',
        name='invoice_status', create_type=True
    )
    invoice_status.create(op.get_bind())
    
    payment_status = ENUM(
        'unpaid', 'partial', 'paid', 'overdue',
        name='payment_status', create_type=True
    )
    payment_status.create(op.get_bind())
    
    payment_method = ENUM(
        'cash', 'bank_transfer', 'cheque', 'card', 'upi', 'other',
        name='payment_method', create_type=True
    )
    payment_method.create(op.get_bind())
    
    movement_reason = ENUM(
        'purchase', 'purchase_return', 'sale', 'sale_return',
        'adjustment_in', 'adjustment_out', 'expired_writeoff',
        'damaged_writeoff', 'opening_stock', 'transfer_in', 'transfer_out',
        name='movement_reason', create_type=True
    )
    movement_reason.create(op.get_bind())
    
    batch_status = ENUM(
        'active', 'quarantined', 'expired', 'depleted',
        name='batch_status', create_type=True
    )
    batch_status.create(op.get_bind())
    
    account_type = ENUM(
        'cash', 'bank', 'receivable', 'payable', 'expense', 'revenue', 'cogs', 'equity', 'asset',
        name='account_type', create_type=True
    )
    account_type.create(op.get_bind())
    
    entity_type = ENUM(
        'customer', 'doctor', 'supplier', 'distributor',
        name='entity_type', create_type=True
    )
    entity_type.create(op.get_bind())
    
    investment_status = ENUM(
        'active', 'recovered', 'written_off',
        name='investment_status', create_type=True
    )
    investment_status.create(op.get_bind())
    
    journal_entry_status = ENUM(
        'draft', 'posted', 'reversed',
        name='journal_entry_status', create_type=True
    )
    journal_entry_status.create(op.get_bind())

    # owner_settings table (singleton)
    op.create_table(
        'owner_settings',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('business_name', sa.String(200), nullable=False),
        sa.Column('business_address', sa.Text(), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('email', sa.String(100), nullable=True),
        sa.Column('tax_number', sa.String(50), nullable=True),
        sa.Column('currency', sa.String(3), nullable=False, server_default='PKR'),
        sa.Column('invoice_prefix', sa.String(20), nullable=False, server_default='INV'),
        sa.Column('purchase_prefix', sa.String(20), nullable=False, server_default='PUR'),
        sa.Column('invoice_number_format', sa.String(50), nullable=False, server_default='{PREFIX}-{YEAR}-{SEQ:06d}'),
        sa.Column('purchase_number_format', sa.String(50), nullable=False, server_default='{PREFIX}-{YEAR}-{SEQ:06d}'),
        sa.Column('financial_year_start_month', sa.Integer(), nullable=False, server_default='7'),
        sa.Column('default_payment_terms_days', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('expiry_alert_days', sa.ARRAY(sa.Integer()), nullable=False, server_default='{90,60,30,7}'),
        sa.Column('default_tax_rate', sa.Numeric(5, 2), nullable=False, server_default='0.00'),
        sa.Column('opening_cash_balance', sa.Numeric(18, 2), nullable=False, server_default='0.00'),
        sa.Column('opening_bank_balance', sa.Numeric(18, 2), nullable=False, server_default='0.00'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('id', name='uq_owner_settings_singleton'),
    )

    # app_user table
    op.create_table(
        'app_user',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('username', sa.String(50), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(100), nullable=True),
        sa.Column('email', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_app_user_username', 'app_user', ['username'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_app_user_username', table_name='app_user')
    op.drop_table('app_user')
    op.drop_table('owner_settings')
    
    # Drop enum types
    for enum_name in [
        'journal_entry_status',
        'investment_status',
        'entity_type',
        'account_type',
        'batch_status',
        'movement_reason',
        'payment_method',
        'payment_status',
        'invoice_status',
    ]:
        op.execute(f'DROP TYPE IF EXISTS {enum_name}')