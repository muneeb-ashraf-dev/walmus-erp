"""Master data tables.

Revision ID: 002
Revises: 001
Create Date: 2024-01-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # manufacturer
    op.create_table(
        'manufacturer',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('contact_person', sa.String(100), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('email', sa.String(100), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('tax_number', sa.String(50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_manufacturer_name', 'manufacturer', ['name'], unique=True)

    # medicine_unit
    op.create_table(
        'medicine_unit',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('code', sa.String(20), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('description', sa.String(200), nullable=True),
        sa.Column('is_base_unit', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_medicine_unit_code', 'medicine_unit', ['code'], unique=True)

    # medicine
    op.create_table(
        'medicine',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('product_code', sa.String(50), nullable=False),
        sa.Column('barcode', sa.String(100), nullable=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('generic_name', sa.String(200), nullable=True),
        sa.Column('manufacturer_id', UUID(as_uuid=True), nullable=True),
        sa.Column('strength', sa.String(100), nullable=True),
        sa.Column('dosage_form', sa.String(50), nullable=True),
        sa.Column('packing_description', sa.String(200), nullable=True),
        sa.Column('base_unit_id', UUID(as_uuid=True), nullable=False),
        sa.Column('units_per_pack', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('purchase_unit_id', UUID(as_uuid=True), nullable=True),
        sa.Column('purchase_conversion_factor', sa.Numeric(18, 4), nullable=False, server_default='1.0'),
        sa.Column('sale_unit_id', UUID(as_uuid=True), nullable=True),
        sa.Column('sale_conversion_factor', sa.Numeric(18, 4), nullable=False, server_default='1.0'),
        sa.Column('default_purchase_rate', sa.Numeric(18, 4), nullable=False, server_default='0.0'),
        sa.Column('default_sale_rate', sa.Numeric(18, 4), nullable=False, server_default='0.0'),
        sa.Column('wholesale_rate', sa.Numeric(18, 4), nullable=True),
        sa.Column('retail_rate', sa.Numeric(18, 4), nullable=True),
        sa.Column('tax_rate', sa.Numeric(5, 2), nullable=False, server_default='0.0'),
        sa.Column('reorder_level', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('min_stock_qty', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['manufacturer_id'], ['manufacturer.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['base_unit_id'], ['medicine_unit.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['purchase_unit_id'], ['medicine_unit.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['sale_unit_id'], ['medicine_unit.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['app_user.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_medicine_product_code', 'medicine', ['product_code'], unique=True)
    op.create_index('ix_medicine_barcode', 'medicine', ['barcode'], unique=True)
    op.create_index('ix_medicine_name', 'medicine', ['name'])
    op.create_index('ix_medicine_manufacturer', 'medicine', ['manufacturer_id'])
    op.create_index('ix_medicine_active', 'medicine', ['is_active'], postgresql_where=sa.text('is_active = true'))

    # supplier
    op.create_table(
        'supplier',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('contact_person', sa.String(100), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('email', sa.String(100), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('tax_number', sa.String(50), nullable=True),
        sa.Column('credit_limit', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('payment_terms_days', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('opening_balance', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('opening_balance_date', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['created_by'], ['app_user.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_supplier_name', 'supplier', ['name'])
    op.create_index('ix_supplier_active', 'supplier', ['is_active'], postgresql_where=sa.text('is_active = true'))

    # customer
    op.create_table(
        'customer',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('contact_person', sa.String(100), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('email', sa.String(100), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('tax_number', sa.String(50), nullable=True),
        sa.Column('customer_type', sa.String(20), nullable=False, server_default='pharmacy'),
        sa.Column('specialty', sa.String(50), nullable=True),
        sa.Column('area', sa.String(100), nullable=True),
        sa.Column('credit_limit', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('payment_terms_days', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('opening_balance', sa.Numeric(18, 2), nullable=False, server_default='0.0'),
        sa.Column('opening_balance_date', sa.Date(), nullable=True),
        sa.Column('default_sale_rate_type', sa.String(20), nullable=False, server_default='retail'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['created_by'], ['app_user.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_customer_name', 'customer', ['name'])
    op.create_index('ix_customer_type', 'customer', ['customer_type'])
    op.create_index('ix_customer_area', 'customer', ['area'])
    op.create_index('ix_customer_active', 'customer', ['is_active'], postgresql_where=sa.text('is_active = true'))

    # doctor_investment
    op.create_table(
        'doctor_investment',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('customer_id', UUID(as_uuid=True), nullable=False),
        sa.Column('investment_amount', sa.Numeric(18, 2), nullable=False),
        sa.Column('investment_date', sa.Date(), nullable=False),
        sa.Column('roi_percentage', sa.Numeric(5, 2), nullable=False),
        sa.Column('expected_sale', sa.Numeric(18, 2), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['customer_id'], ['customer.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['app_user.id'], ondelete='SET NULL'),
        sa.CheckConstraint('investment_amount >= 0', name='ck_investment_amount_nonneg'),
        sa.CheckConstraint('roi_percentage > 0', name='ck_investment_roi_positive'),
    )
    op.create_index('ix_doctor_investment_customer', 'doctor_investment', ['customer_id'])
    op.create_index('ix_doctor_investment_status', 'doctor_investment', ['status'])


def downgrade() -> None:
    op.drop_index('ix_doctor_investment_status', table_name='doctor_investment')
    op.drop_index('ix_doctor_investment_customer', table_name='doctor_investment')
    op.drop_table('doctor_investment')
    
    op.drop_index('ix_customer_active', table_name='customer')
    op.drop_index('ix_customer_area', table_name='customer')
    op.drop_index('ix_customer_type', table_name='customer')
    op.drop_index('ix_customer_name', table_name='customer')
    op.drop_table('customer')
    
    op.drop_index('ix_supplier_active', table_name='supplier')
    op.drop_index('ix_supplier_name', table_name='supplier')
    op.drop_table('supplier')
    
    op.drop_index('ix_medicine_active', table_name='medicine')
    op.drop_index('ix_medicine_manufacturer', table_name='medicine')
    op.drop_index('ix_medicine_name', table_name='medicine')
    op.drop_index('ix_medicine_barcode', table_name='medicine')
    op.drop_index('ix_medicine_product_code', table_name='medicine')
    op.drop_table('medicine')
    
    op.drop_index('ix_medicine_unit_code', table_name='medicine_unit')
    op.drop_table('medicine_unit')
    
    op.drop_index('ix_manufacturer_name', table_name='manufacturer')
    op.drop_table('manufacturer')