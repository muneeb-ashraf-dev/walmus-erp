"""Add optional invoice links to payments.

The Payment model exposes optional ``purchase_invoice_id`` and
``sales_invoice_id`` columns, but migration 004 only created the generic
``payment_allocation`` table. Queries selecting Payment therefore failed with
``column payment.purchase_invoice_id does not exist``. This migration aligns the
database with the model while keeping allocations as the primary mechanism.

Revision ID: 012
Revises: 011
Create Date: 2026-10-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '012'
down_revision = '011'
branch_labels = None
depends_on = None


def _columns() -> set:
    inspector = sa.inspect(op.get_bind())
    return {column['name'] for column in inspector.get_columns('payment')}


def upgrade() -> None:
    columns = _columns()

    if 'purchase_invoice_id' not in columns:
        op.add_column('payment', sa.Column('purchase_invoice_id', UUID(as_uuid=True), nullable=True))
        op.create_foreign_key(
            'fk_payment_purchase_invoice',
            'payment',
            'purchase_invoice',
            ['purchase_invoice_id'],
            ['id'],
            ondelete='SET NULL',
        )
        op.create_index('ix_payment_purchase_invoice', 'payment', ['purchase_invoice_id'])

    if 'sales_invoice_id' not in columns:
        op.add_column('payment', sa.Column('sales_invoice_id', UUID(as_uuid=True), nullable=True))
        op.create_foreign_key(
            'fk_payment_sales_invoice',
            'payment',
            'sales_invoice',
            ['sales_invoice_id'],
            ['id'],
            ondelete='SET NULL',
        )
        op.create_index('ix_payment_sales_invoice', 'payment', ['sales_invoice_id'])


def downgrade() -> None:
    columns = _columns()

    if 'purchase_invoice_id' in columns:
        op.drop_index('ix_payment_purchase_invoice', table_name='payment')
        op.drop_constraint('fk_payment_purchase_invoice', 'payment', type_='foreignkey')
        op.drop_column('payment', 'purchase_invoice_id')

    if 'sales_invoice_id' in columns:
        op.drop_index('ix_payment_sales_invoice', table_name='payment')
        op.drop_constraint('fk_payment_sales_invoice', 'payment', type_='foreignkey')
        op.drop_column('payment', 'sales_invoice_id')
