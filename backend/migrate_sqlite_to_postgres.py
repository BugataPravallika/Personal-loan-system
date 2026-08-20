"""Copy the local SQLite database into a PostgreSQL database.

Run with SOURCE_DATABASE_URL and DATABASE_URL set. The source database is only
read, and existing rows in the destination are preserved unless they share a
primary key with a source row.
"""
import os

from sqlalchemy import create_engine, delete, insert, select

from app import models  # noqa: F401
from app.database import Base


def database_url(name: str) -> str:
    value = os.environ[name]
    if value.startswith("postgres://"):
        return value.replace("postgres://", "postgresql+psycopg://", 1)
    if value.startswith("postgresql://"):
        return value.replace("postgresql://", "postgresql+psycopg://", 1)
    return value


def main():
    source = create_engine(database_url("SOURCE_DATABASE_URL"))
    target = create_engine(
        database_url("DATABASE_URL"),
        connect_args={"prepare_threshold": None},
        pool_pre_ping=True,
    )
    Base.metadata.create_all(target)

    with source.connect() as source_connection, target.begin() as target_connection:
        for table in Base.metadata.sorted_tables:
            rows = source_connection.execute(select(table)).mappings().all()
            if not rows:
                continue

            columns = [column.name for column in table.columns]
            values = [{column: row[column] for column in columns} for row in rows]
            primary_key_columns = list(table.primary_key.columns)
            for value in values:
                existing = target_connection.execute(
                    select(table).where(
                        *[column == value[column.name] for column in primary_key_columns]
                    )
                ).first()
                if existing:
                    target_connection.execute(
                        delete(table).where(
                            *[column == value[column.name] for column in primary_key_columns]
                        )
                    )
                target_connection.execute(insert(table).values(value))
            print(f"{table.name}: copied {len(values)} row(s)")

    print("Migration complete. The SQLite source was not modified.")


if __name__ == "__main__":
    main()