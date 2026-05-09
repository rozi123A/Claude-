import os
import pymysql
from urllib.parse import urlparse

def setup_db():
    db_url = "mysql://root:AQdAADUhpvdHeaUpXvojHFvZOJJHxjDg@switchyard.proxy.rlwy.net:18411/railway"
    url = urlparse(db_url)
    
    connection = pymysql.connect(
        host=url.hostname,
        user=url.username,
        password=url.password,
        port=url.port,
        database=url.path[1:],
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )
    
    try:
        with connection.cursor() as cursor:
            # Read SQL file
            with open('drizzle/0000_easy_marrow.sql', 'r') as f:
                sql_content = f.read()
            
            # Split by statement-breakpoint
            statements = sql_content.split('--> statement-breakpoint')
            
            for statement in statements:
                if statement.strip():
                    try:
                        cursor.execute(statement)
                        print(f"Executed statement successfully")
                    except Exception as e:
                        if "already exists" in str(e).lower():
                            print(f"Table already exists, skipping...")
                        else:
                            print(f"Error executing statement: {e}")
            
            # Insert default settings if not exists
            default_settings = [
                ("starsRate", "1000"),
                ("minWithdraw", "10000"),
                ("adReward", "100"),
                ("adCooldown", "30")
            ]
            
            for key, value in default_settings:
                try:
                    cursor.execute("INSERT IGNORE INTO settings (`key`, `value`) VALUES (%s, %s)", (key, value))
                    print(f"Inserted setting {key}={value}")
                except Exception as e:
                    print(f"Error inserting setting {key}: {e}")
            
            connection.commit()
            print("Database setup completed successfully!")
            
    finally:
        connection.close()

if __name__ == "__main__":
    setup_db()
