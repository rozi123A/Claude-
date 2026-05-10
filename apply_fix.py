import mysql.connector
import os
from dotenv import load_dotenv
import urllib.parse as urlparse

load_dotenv()

db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("DATABASE_URL not found")
    exit(1)

url = urlparse.urlparse(db_url)

config = {
    'user': url.username,
    'password': url.password,
    'host': url.hostname,
    'port': url.port,
    'database': url.path[1:],
}

sql_file = 'fix_db.sql'

try:
    conn = mysql.connector.connect(**config)
    cursor = conn.cursor()
    
    with open(sql_file, 'r') as f:
        sql_content = f.read()
    
    statements = sql_content.split(';')
    
    for statement in statements:
        if statement.strip():
            try:
                cursor.execute(statement)
                print(f"Executed: {statement.strip()}")
            except mysql.connector.Error as err:
                print(f"Error: {err}")
    
    conn.commit()
    print("Database fix applied successfully!")
    
except Exception as e:
    print(f"Failed to apply fix: {e}")
finally:
    if 'conn' in locals() and conn.is_connected():
        cursor.close()
        conn.close()
