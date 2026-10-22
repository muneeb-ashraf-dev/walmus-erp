"""Align audit timestamp columns with the SQLAlchemy BaseModel.

Several early migrations created tables with only one (or neither) of the
``created_at`` / ``updated_at`` columns, while every model inherits both from
``BaseModel``. Queries against those tables failed at runtime. This migration
adds the missing columns with safe defaults.

Revision ID: 011
Revises: 010
Create Date: 2026-10-22
"""
from alembic import op
import sqlalchemy as sa

revision = '011'
down_revision = '010'
branch_labels = None
depends_on = None

TABLES = [
    'application_setting',
    'audit_log',
    'expense',
    'expense_category',
    'inventory_movement',
    'journal_entry',
    'journal_entry_line',
    'number_sequence',
    'opening_balance',
    'opening_balance_item',
    'payment',
    'payment_allocation',
    'purchase_invoice_item',
    'purchase_return_item',
    'sales_invoice_item',
    'sales_return_item',
    'stock_adjustment_item',
]


def _columns(table: str) -> set:
    inspector = sa.inspect(op.get_bind())
    return {column['name'] for column in inspector.get_columns(table)}


def upgrade() -> None:
    for table in TABLES:
        columns = _columns(table)
        if 'created_at' not in columns:
            op.add_column(
                table,
                sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            )
        if 'updated_at' not in columns:
            op.add_column(
                table,
                sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            )


def downgrade() -> None:
    # The columns are part of the model contract; dropping them would break the
    # application. Intentionally left as a no-op.
    pass
