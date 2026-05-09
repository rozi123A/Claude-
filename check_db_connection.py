import mysql.connector
import sys

db_url = "mysql://root:AQdAADUhpvdHeaUpXvojHFvZOJJHxjDg@switchyard.proxy.rlwy.net:18411/railway"

try:
    # Parse the URL manually
    # mysql://user:password@host:port/database
    parts = db_url.replace("mysql://", "").split("@")
    user_pass = parts[0].split(":")
    host_port_db = parts[1].split("/")
    host_port = host_port_db[0].split(":")
    
    user = user_pass[0]
    password = user_pass[1]
    host = host_port[0]
    port = host_port[1]
    database = host_port_db[1]

    print(f"Connecting to {host}:{port}/{database} as {user}...")
    
    conn = mysql.connector.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database
    )
    
    cursor = conn.cursor()
    cursor.execute("SHOW TABLES")
    tables = cursor.fetchall()
    print("Tables in database:")
    for table in tables:
        print(f"- {table[0]}")
        
    # Check telegram_users table structure
    cursor.execute("DESCRIBE telegram_users")
    columns = cursor.fetchall()
    print("\nStructure of telegram_users:")
    for col in columns:
        print(col)
        
    conn.close()
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
