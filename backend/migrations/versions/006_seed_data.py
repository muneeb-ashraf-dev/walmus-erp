"""Seed data: default units, expense categories, financial accounts, number sequences.

Revision ID: 006
Revises: 005
Create Date: 2024-01-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from datetime import date

# revision identifiers, used by Alembic.
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Insert default medicine units
    op.execute("""
        INSERT INTO medicine_unit (id, code, name, description, is_base_unit, sort_order) VALUES
        (gen_random_uuid(), 'TAB', 'Tablet', 'Individual tablet', true, 1),
        (gen_random_uuid(), 'CAP', 'Capsule', 'Individual capsule', false, 2),
        (gen_random_uuid(), 'BOT', 'Bottle', 'Bottle (syrup, suspension)', false, 3),
        (gen_random_uuid(), 'INJ', 'Injection', 'Vial/Ampoule for injection', false, 4),
        (gen_random_uuid(), 'BOX', 'Box', 'Box of strips/blisters', false, 5),
        (gen_random_uuid(), 'STRIP', 'Strip', 'Strip of tablets/capsules', false, 6),
        (gen_random_uuid(), 'SACHET', 'Sachet', 'Individual sachet', false, 7),
        (gen_random_uuid(), 'TUBE', 'Tube', 'Tube (ointment, cream)', false, 8),
        (gen_random_uuid(), 'DROP', 'Dropper', 'Dropper bottle', false, 9),
        (gen_random_uuid(), 'ML', 'Milliliter', 'Volume in milliliters', false, 10)
        ON CONFLICT (code) DO NOTHING;
    """)

    # Insert default expense categories
    op.execute("""
        INSERT INTO expense_category (id, code, name, description, sort_order) VALUES
        (gen_random_uuid(), 'RENT', 'Rent', 'Office/warehouse rent', 1),
        (gen_random_uuid(), 'SALARY', 'Salaries & Wages', 'Employee salaries and wages', 2),
        (gen_random_uuid(), 'ELECTRICITY', 'Electricity', 'Electricity bills', 3),
        (gen_random_uuid(), 'FUEL', 'Fuel / Petrol', 'Vehicle fuel and petrol', 4),
        (gen_random_uuid(), 'TRANSPORT', 'Transportation', 'Transport and logistics', 5),
        (gen_random_uuid(), 'TELEPHONE', 'Telephone & Internet', 'Phone and internet bills', 6),
        (gen_random_uuid(), 'OFFICE', 'Office Expenses', 'General office expenses', 7),
        (gen_random_uuid(), 'SAMPLE', 'Free Samples', 'Medicine samples given to doctors', 8),
        (gen_random_uuid(), 'MARKETING', 'Marketing & Promotion', 'Advertising and promotion', 9),
        (gen_random_uuid(), 'REPAIRS', 'Repairs & Maintenance', 'Equipment and facility maintenance', 10),
        (gen_random_uuid(), 'INSURANCE', 'Insurance', 'Business insurance premiums', 11),
        (gen_random_uuid(), 'LEGAL', 'Legal & Professional', 'Legal and professional fees', 12),
        (gen_random_uuid(), 'BANK_CHARGES', 'Bank Charges', 'Bank fees and charges', 13),
        (gen_random_uuid(), 'OTHER', 'Other Expenses', 'Miscellaneous expenses', 99)
        ON CONFLICT (code) DO NOTHING;
    """)

    # Insert default financial accounts
    op.execute("""
        INSERT INTO financial_account (id, code, name, account_type, opening_balance) VALUES
        (gen_random_uuid(), 'CASH', 'Cash in Hand', 'cash', 0.00),
        (gen_random_uuid(), 'BANK', 'Bank Account', 'bank', 0.00),
        (gen_random_uuid(), 'RECEIVABLE', 'Accounts Receivable', 'receivable', 0.00),
        (gen_random_uuid(), 'PAYABLE', 'Accounts Payable', 'payable', 0.00),
        (gen_random_uuid(), 'SALES_REV', 'Sales Revenue', 'revenue', 0.00),
        (gen_random_uuid(), 'COGS', 'Cost of Goods Sold', 'cogs', 0.00),
        (gen_random_uuid(), 'EXPENSE', 'Operating Expenses', 'expense', 0.00),
        (gen_random_uuid(), 'DISCOUNT_GIVEN', 'Discount Allowed', 'expense', 0.00),
        (gen_random_uuid(), 'DISCOUNT_RECEIVED', 'Discount Received', 'revenue', 0.00),
        (gen_random_uuid(), 'TAX_PAYABLE', 'Tax Payable', 'payable', 0.00),
        (gen_random_uuid(), 'INVENTORY', 'Inventory Asset', 'asset', 0.00),
        (gen_random_uuid(), 'QUARANTINE_INV', 'Quarantine Inventory', 'asset', 0.00),
        (gen_random_uuid(), 'ADVANCE_CUST', 'Advance from Customers', 'payable', 0.00),
        (gen_random_uuid(), 'ADVANCE_SUPP', 'Advance to Suppliers', 'asset', 0.00),
        (gen_random_uuid(), 'ADVANCE_DOC', 'Advance to Doctors', 'asset', 0.00),
        (gen_random_uuid(), 'RETAINED_EARNINGS', 'Retained Earnings', 'equity', 0.00),
        (gen_random_uuid(), 'OWNER_CAPITAL', 'Owner''s Capital', 'equity', 0.00)
        ON CONFLICT (code) DO NOTHING;
    """)

    # Insert default number sequences for current financial year
    op.execute("""
        -- We'll insert for a range of years; the app will create as needed
        INSERT INTO number_sequence (id, prefix, current_sequence, financial_year, format_template) VALUES
        (gen_random_uuid(), 'INV', 0, EXTRACT(YEAR FROM CURRENT_DATE)::int, '{PREFIX}-{YEAR}-{SEQ:06d}'),
        (gen_random_uuid(), 'PUR', 0, EXTRACT(YEAR FROM CURRENT_DATE)::int, '{PREFIX}-{YEAR}-{SEQ:06d}'),
        (gen_random_uuid(), 'CRN', 0, EXTRACT(YEAR FROM CURRENT_DATE)::int, '{PREFIX}-{YEAR}-{SEQ:06d}'),
        (gen_random_uuid(), 'DBN', 0, EXTRACT(YEAR FROM CURRENT_DATE)::int, '{PREFIX}-{YEAR}-{SEQ:06d}'),
        (gen_random_uuid(), 'PAY', 0, EXTRACT(YEAR FROM CURRENT_DATE)::int, '{PREFIX}-{YEAR}-{SEQ:06d}'),
        (gen_random_uuid(), 'EXP', 0, EXTRACT(YEAR FROM CURRENT_DATE)::int, '{PREFIX}-{YEAR}-{SEQ:06d}'),
        (gen_random_uuid(), 'ADJ', 0, EXTRACT(YEAR FROM CURRENT_DATE)::int, '{PREFIX}-{YEAR}-{SEQ:06d}'),
        (gen_random_uuid(), 'OB', 0, EXTRACT(YEAR FROM CURRENT_DATE)::int, '{PREFIX}-{YEAR}-{SEQ:06d}')
        ON CONFLICT (prefix, financial_year) DO NOTHING;
    """)


def downgrade() -> None:
    # Delete seed data (be careful with foreign keys)
    op.execute("DELETE FROM number_sequence WHERE prefix IN ('INV','PUR','CRN','DBN','PAY','EXP','ADJ','OB')")
    op.execute("DELETE FROM financial_account WHERE code IN ('CASH','BANK','RECEIVABLE','PAYABLE','SALES_REV','COGS','EXPENSE','DISCOUNT_GIVEN','DISCOUNT_RECEIVED','TAX_PAYABLE','INVENTORY','QUARANTINE_INV','ADVANCE_CUST','ADVANCE_SUPP','ADVANCE_DOC','RETAINED_EARNINGS','OWNER_CAPITAL')")
    op.execute("DELETE FROM expense_category WHERE code IN ('RENT','SALARY','ELECTRICITY','FUEL','TRANSPORT','TELEPHONE','OFFICE','SAMPLE','MARKETING','REPAIRS','INSURANCE','LEGAL','BANK_CHARGES','OTHER')")
    op.execute("DELETE FROM medicine_unit WHERE code IN ('TAB','CAP','BOT','INJ','BOX','STRIP','SACHET','TUBE','DROP','ML')")