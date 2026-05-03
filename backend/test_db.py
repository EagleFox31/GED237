import psycopg2

try:
    conn = psycopg2.connect("postgresql://postgres:Postgresql@127.0.0.1:5432/edossier")
    print("Success")
except Exception as e:
    print(repr(e))
