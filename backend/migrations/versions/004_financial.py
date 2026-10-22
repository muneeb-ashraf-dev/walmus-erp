"""Financial tables: accounts, journal entries, payments, expenses.

Revision ID: 004
Revises: 003
Create Date: 2024-01-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # financial_account
    op.create_table(
        'financial_account',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('code', sa.String(20), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('account_type', sa.String(20), nullable=False),
        sa.Column('currency', sa.String(3), nullable=False, server_default='PKR'),
        sa.Column('opening_balance', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('opening_balance_date', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', name='uq_financial_account_code'),
    )

    # journal_entry
    op.create_table(
        'journal_entry',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('entry_number', sa.String(50), nullable=False),
        sa.Column('entry_date', sa.Date(), nullable=False),
        sa.Column('reference_type', sa.String(50), nullable=True),
        sa.Column('reference_id', UUID(as_uuid=True), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('total_debit', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('total_credit', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('status', sa.String(20), nullable=False, server_default='posted'),
        sa.Column('reversed_entry_id', UUID(as_uuid=True), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['reversed_entry_id'], ['journal_entry.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['app_user.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('entry_number', name='uq_journal_entry_number'),
        sa.CheckConstraint('total_debit = total_credit', name='ck_journal_balanced'),
    )
    op.create_index('ix_je_date', 'journal_entry', ['entry_date'])
    op.create_index('ix_je_reference', 'journal_entry', ['reference_type', 'reference_id'])

    # journal_entry_line
    op.create_table(
        'journal_entry_line',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('journal_entry_id', UUID(as_uuid=True), nullable=False),
        sa.Column('account_id', UUID(as_uuid=True), nullable=False),
        sa.Column('line_number', sa.Integer(), nullable=False),
        sa.Column('entry_type', sa.String(6), nullable=False),
        sa.Column('amount', sa.Numeric(18, 2), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('party_type', sa.String(20), nullable=True),
        sa.Column('party_id', UUID(as_uuid=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['journal_entry_id'], ['journal_entry.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['account_id'], ['financial_account.id'], ondelete='RESTRICT'),
        sa.UniqueConstraint('journal_entry_id', 'line_number', name='uq_jel_line'),
        sa.CheckConstraint("entry_type IN ('debit', 'credit')", name='ck_jel_entry_type'),
        sa.CheckConstraint('amount > 0', name='ck_jel_amount_positive'),
    )
    op.create_index('ix_jel_account', 'journal_entry_line', ['account_id'])
    op.create_index('ix_jel_party', 'journal_entry_line', ['party_type', 'party_id'])
    op.create_index('ix_jel_entry', 'journal_entry_line', ['journal_entry_id'])

    # payment
    op.create_table(
        'payment',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('payment_number', sa.String(50), nullable=False),
        sa.Column('payment_date', sa.Date(), nullable=False, server_default=sa.text('CURRENT_DATE')),
        sa.Column('account_id', UUID(as_uuid=True), nullable=False),
        sa.Column('party_type', sa.String(20), nullable=False),
        sa.Column('party_id', UUID(as_uuid=True), nullable=False),
        sa.Column('payment_method', sa.String(20), nullable=False),
        sa.Column('amount', sa.Numeric(18, 2), nullable=False),
        sa.Column('reference_number', sa.String(100), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='posted'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['account_id'], ['financial_account.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['created_by'], ['app_user.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('payment_number', name='uq_payment_number'),
        sa.CheckConstraint("party_type IN ('customer', 'supplier')", name='ck_payment_party_type'),
        sa.CheckConstraint('amount > 0', name='ck_payment_amount_positive'),
    )
    op.create_index('ix_payment_party', 'payment', ['party_type', 'party_id'])
    op.create_index('ix_payment_date', 'payment', ['payment_date'])
    op.create_index('ix_payment_account', 'payment', ['account_id'])

    # payment_allocation
    op.create_table(
        'payment_allocation',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('payment_id', UUID(as_uuid=True), nullable=False),
        sa.Column('invoice_type', sa.String(20), nullable=False),
        sa.Column('invoice_id', UUID(as_uuid=True), nullable=False),
        sa.Column('allocated_amount', sa.Numeric(18, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['payment_id'], ['payment.id'], ondelete='CASCADE'),
        sa.CheckConstraint("invoice_type IN ('sales', 'purchase')", name='ck_alloc_invoice_type'),
        sa.CheckConstraint('allocated_amount > 0', name='ck_alloc_amount_positive'),
    )
    op.create_index('ix_alloc_payment', 'payment_allocation', ['payment_id'])
    op.create_index('ix_alloc_invoice', 'payment_allocation', ['invoice_type', 'invoice_id'])

    # expense_category
    op.create_table(
        'expense_category',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('code', sa.String(20), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', name='uq_expense_category_code'),
    )

    # expense
    op.create_table(
        'expense',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('expense_number', sa.String(50), nullable=False),
        sa.Column('expense_date', sa.Date(), nullable=False),
        sa.Column('category_id', UUID(as_uuid=True), nullable=False),
        sa.Column('account_id', UUID(as_uuid=True), nullable=False),
        sa.Column('amount', sa.Numeric(18, 2), nullable=False),
        sa.Column('tax_amount', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('reference_number', sa.String(100), nullable=True),
        sa.Column('attachment_path', sa.String(500), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='posted'),
        sa.Column('medicine_id', UUID(as_uuid=True), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['category_id'], ['expense_category.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['account_id'], ['financial_account.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['medicine_id'], ['medicine.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['app_user.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('expense_number', name='uq_expense_number'),
        sa.CheckConstraint('amount > 0', name='ck_expense_amount_positive'),
    )
    op.create_index('ix_expense_date', 'expense', ['expense_date'])
    op.create_index('ix_expense_category', 'expense', ['category_id'])
    op.create_index('ix_expense_account', 'expense', ['account_id'])
    op.create_index('ix_expense_medicine', 'expense', ['medicine_id'])

    # opening_balance
    op.create_table(
        'opening_balance',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('balance_date', sa.Date(), nullable=False),
        sa.Column('description', sa.String(200), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('posted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('posted_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['posted_by'], ['app_user.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('balance_date', name='uq_opening_balance_date'),
    )

    # opening_balance_item
    op.create_table(
        'opening_balance_item',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('opening_balance_id', UUID(as_uuid=True), nullable=False),
        sa.Column('item_type', sa.String(20), nullable=False),
        sa.Column('reference_id', UUID(as_uuid=True), nullable=False),
        sa.Column('quantity', sa.Numeric(18, 4), nullable=True),
        sa.Column('unit_cost', sa.Numeric(18, 4), nullable=True),
        sa.Column('amount', sa.Numeric(18, 2), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['opening_balance_id'], ['opening_balance.id'], ondelete='CASCADE'),
        sa.CheckConstraint(
            "item_type IN ('medicine_batch', 'supplier', 'customer', 'cash', 'bank', 'expense_category')",
            name='ck_ob_item_type'
        ),
    )
    op.create_index('ix_ob_item_balance', 'opening_balance_item', ['opening_balance_id'])

    # number_sequence
    op.create_table(
        'number_sequence',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('prefix', sa.String(20), nullable=False),
        sa.Column('current_sequence', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('financial_year', sa.Integer(), nullable=False),
        sa.Column('format_template', sa.String(100), nullable=False, server_default='{PREFIX}-{YEAR}-{SEQ:06d}'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('prefix', 'financial_year', name='uq_number_sequence'),
    )


def downgrade() -> None:
    op.drop_table('number_sequence')
    op.drop_index('ix_ob_item_balance', table_name='opening_balance_item')
    op.drop_table('opening_balance_item')
    op.drop_table('opening_balance')
    op.drop_index('ix_expense_medicine', table_name='expense')
    op.drop_index('ix_expense_account', table_name='expense')
    op.drop_index('ix_expense_category', table_name='expense')
    op.drop_index('ix_expense_date', table_name='expense')
    op.drop_table('expense')
    op.drop_table('expense_category')
    op.drop_index('ix_alloc_invoice', table_name='payment_allocation')
    op.drop_index('ix_alloc_payment', table_name='payment_allocation')
    op.drop_table('payment_allocation')
    op.drop_index('ix_payment_account', table_name='payment')
    op.drop_index('ix_payment_date', table_name='payment')
    op.drop_index('ix_payment_party', table_name='payment')
    op.drop_table('payment')
    op.drop_index('ix_jel_entry', table_name='journal_entry_line')
    op.drop_index('ix_jel_party', table_name='journal_entry_line')
    op.drop_index('ix_jel_account', table_name='journal_entry_line')
    op.drop_table('journal_entry_line')
    op.drop_index('ix_je_reference', table_name='journal_entry')
    op.drop_index('ix_je_date', table_name='journal_entry')
    op.drop_table('journal_entry')
    op.drop_table('financial_account')