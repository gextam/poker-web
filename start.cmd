@echo off
cd /d "%~dp0"
start "" "http://localhost:8768/"
python -m http.server 8768 --bind 127.0.0.1
