"""Fix FK constraints blocking user deletion

Revision ID: b2c3d4e5f9a1
Revises: a1b2c3d4e5f8
Create Date: 2026-06-05

tickets.assignee_id  → ON DELETE SET NULL  (already nullable)
ticket_messages.sender_id → nullable + ON DELETE SET NULL
"""

from alembic import op

revision = "b2c3d4e5f9a1"
down_revision = "a1b2c3d4e5f8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # tickets.assignee_id: drop plain FK, recreate with SET NULL
    op.drop_constraint(
        "tickets_assignee_id_fkey", "tickets", type_="foreignkey"
    )
    op.create_foreign_key(
        "tickets_assignee_id_fkey",
        "tickets",
        "users",
        ["assignee_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # ticket_messages.sender_id: make nullable, then SET NULL on delete
    op.alter_column("ticket_messages", "sender_id", nullable=True)
    op.drop_constraint(
        "ticket_messages_sender_id_fkey", "ticket_messages", type_="foreignkey"
    )
    op.create_foreign_key(
        "ticket_messages_sender_id_fkey",
        "ticket_messages",
        "users",
        ["sender_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    # Revert ticket_messages.sender_id
    op.drop_constraint(
        "ticket_messages_sender_id_fkey", "ticket_messages", type_="foreignkey"
    )
    op.create_foreign_key(
        "ticket_messages_sender_id_fkey",
        "ticket_messages",
        "users",
        ["sender_id"],
        ["id"],
    )
    op.alter_column("ticket_messages", "sender_id", nullable=False)

    # Revert tickets.assignee_id
    op.drop_constraint(
        "tickets_assignee_id_fkey", "tickets", type_="foreignkey"
    )
    op.create_foreign_key(
        "tickets_assignee_id_fkey",
        "tickets",
        "users",
        ["assignee_id"],
        ["id"],
    )
