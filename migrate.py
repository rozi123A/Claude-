import mysql.connector
import os
from dotenv import load_dotenv
import urllib.parse as urlparse

load_dotenv()

db_url = os.getenv("DATABASE_URL")
url = urlparse.urlparse(db_url)

config = {
    'user': url.username,
    'password': url.password,
    'host': url.hostname,
    'port': url.port,
    'database': url.path[1:],
}

sql_file = 'drizzle/0000_easy_marrow.sql'

try:
    conn = mysql.connector.connect(**config)
    cursor = conn.cursor()
    
    with open(sql_file, 'r') as f:
        sql_content = f.read()
    
    # Split by statement-breakpoint or semicolon
    statements = sql_content.split('--> statement-breakpoint')
    
    for statement in statements:
        if statement.strip():
            try:
                cursor.execute(statement)
                print(f"Executed statement successfully.")
            except mysql.connector.Error as err:
                if "already exists" in str(err):
                    print(f"Table or column already exists, skipping...")
                else:
                    print(f"Error: {err}")
    
    conn.commit()
    print("Migration completed successfully!")
    
except Exception as e:
    print(f"Failed to migrate: {e}")
finally:
    if 'conn' in locals() and conn.is_connected():
        cursor.close()
        conn.close()
