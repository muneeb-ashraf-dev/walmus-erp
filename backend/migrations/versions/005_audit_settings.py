"""Audit and settings tables.

Revision ID: 005
Revises: 004
Create Date: 2024-01-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET

# revision identifiers, used by Alembic.
revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # audit_log
    op.create_table(
        'audit_log',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('event_time', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('user_id', UUID(as_uuid=True), nullable=True),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', UUID(as_uuid=True), nullable=True),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('old_values', JSONB, nullable=True),
        sa.Column('new_values', JSONB, nullable=True),
        sa.Column('ip_address', INET, nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('session_id', sa.String(100), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['app_user.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_audit_entity', 'audit_log', ['entity_type', 'entity_id'])
    op.create_index('ix_audit_user_time', 'audit_log', ['user_id', 'event_time'])
    op.create_index('ix_audit_time', 'audit_log', ['event_time'])

    # application_setting
    op.create_table(
        'application_setting',
        sa.Column('key', sa.String(100), nullable=False),
        sa.Column('value', JSONB, nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('updated_by', UUID(as_uuid=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('key'),
        sa.ForeignKeyConstraint(['updated_by'], ['app_user.id'], ondelete='SET NULL'),
    )


def downgrade() -> None:
    op.drop_table('application_setting')
    op.drop_index('ix_audit_time', table_name='audit_log')
    op.drop_index('ix_audit_user_time', table_name='audit_log')
    op.drop_index('ix_audit_entity', table_name='audit_log')
    op.drop_table('audit_log')