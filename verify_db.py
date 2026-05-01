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

try:
    conn = mysql.connector.connect(**config)
    cursor = conn.cursor()
    
    cursor.execute("SHOW TABLES")
    tables = cursor.fetchall()
    
    print("Tables in database:")
    for table in tables:
        print(f"- {table[0]}")
    
    expected_tables = ['ad_tokens', 'settings', 'telegram_users', 'transactions', 'withdrawals']
    found_tables = [t[0] for t in tables]
    
    missing = [t for t in expected_tables if t not in found_tables]
    
    if not missing:
        print("\nAll required tables are present!")
    else:
        print(f"\nMissing tables: {missing}")
        
except Exception as e:
    print(f"Verification failed: {e}")
finally:
    if 'conn' in locals() and conn.is_connected():
        cursor.close()
        conn.close()
