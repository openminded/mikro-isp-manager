# Deployment Guide

## 1. Prepare for Production
Before uploading to aaPanel, you must build the frontend and ensure the server is ready.

1.  **Build Frontend**:
    Open your terminal in VS Code and run:
    ```bash
    npm run build
    ```
    This creates a `dist` folder containing your website.

2.  **Verify Structure**:
    Ensure you have:
    -   `dist/` (folder from step 1)
    -   `server/` (folder containing `index.js`, `package.json` should be in root or server depending on your setup)

    *Note: The current project structure has `package.json` in the root and `server/index.js`.*

## 2. Deploy to aaPanel
You are getting a `MODULE_NOT_FOUND` error because of incorrect **Run Directory** or **Start File** settings.

### fixing the "server/server/index.js" Error:
1.  Go to **aaPanel > Website > Node Project**.
2.  Edit your project settings.
3.  **Run Directory**: Set this to the **Root** of your uploaded project (e.g., `/www/wwwroot/telaju`).
    -   *Do NOT set it to `/www/wwwroot/telaju/server` unless you only uploaded the server folder there.*
4.  **Start File**: Set this to `server/index.js`.
    -   *If your Run Directory is `/www/wwwroot/telaju`, then `server/index.js` is correct.*
    -   *If your Run Directory is `/www/wwwroot/telaju/server`, then Start File should be just `index.js`.*
    -   **The Error `.../server/server/index.js` happens when Run Directory ends in `server` AND Start File starts with `server/`.**

### Recommended Setup:
1.  Upload the **Entire Project** to `/www/wwwroot/telaju`.
    -   Includes: `dist`, `server`, `package.json`, `node_modules`.
2.  **Run Directory**: `/www/wwwroot/telaju`
3.  **Start File**: `server/index.js`
4.  **Run Command**: `npm run server` (Make sure `package.json` has `"server": "node server/index.js"`) OR just Select `server/index.js` as the script.
5.  **Port**: `3001` (The server is configured to listen on `process.env.PORT` or `3001`).

## 3. Cloudflare Zero Trust / Tunnel
Since you successfully deployed locally, you can expose it securely.

1.  **Install Cloudflared** on your VPS (aaPanel).
2.  **Create a Tunnel**:
    ```bash
    cloudflared tunnel create new-isp
    ```
3.  **Configure Tunnel**:
    Create `config.yml`:
    ```yaml
    tunnel: <Tunnel-UUID>
    credentials-file: /root/.cloudflared/<Tunnel-UUID>.json

    ingress:
      - hostname: isp.yourdomain.com
        service: http://localhost:3001
      - service: http_status:404
    ```
    *Note: We point to `localhost:3001` because your Node.js server is hosting BOTH the React App and the API on port 3001.*

4.  **Run Tunnel**:
    ```bash
    cloudflared tunnel run new-isp
    ```

## 4. Troubleshooting
-   **Server Wont Start**: Check Logs in aaPanel.
-   **"Address already in use"**: Kill the process using port 3001 or change the port in aaPanel settings.
-   **Frontend 404**: Ensure the `dist` folder is uploaded and is a sibling of the `server` folder (or verify the path in `server/index.js`).
71: 
## 5. Safe Update Procedure (Prevention of Data Loss)
**CRITICAL**: Your database (`server/data/*.json`, `server/crm.sqlite`) and user uploads (`server/uploads/`) are stored INSIDE the `server` folder.
**DO NOT** simply overwrite the entire `server` folder when updating, or you will **LOSE All DATA**.

### How to Update Correctly:

#### Method A: Selective Upload (Recommended)
1.  **Frontend**: It is safe to delete/overwrite the `dist` folder completely. Upload the new `dist` folder.
2.  **Backend**:
    -   Upload `server/index.js` (Overwrite)
    -   Upload `server/models/` (Overwrite folder)
    -   Upload `server/package.json` (Overwrite)
    -   **DO NOT** upload/overwrite the `server/data/` folder.
    -   **DO NOT** upload/overwrite the `server/uploads/` folder.
    -   **DO NOT** overwrite `server/crm.sqlite` if it exists.

#### Method B: Backup & Swap (Safer)
1.  Go to File Manager in aaPanel.
2.  Rename your existing `server` folder to `server_backup_DATE`.
3.  Upload your NEW `server` folder.
4.  Copy the `data` folder and `uploads` folder from `server_backup_DATE` into your NEW `server` folder.
5.  Copy `crm.sqlite` (if using SQL) from `server_backup_DATE` to your NEW `server` folder.
6.  Restart the Node Project.

## 6. Handling Schema Changes (New Parameters)
You asked: "If the new server file has new parameters, will it be a problem with old data?"

**Answer**: Generally, **NO**, it won't be a problem, but we have added safety mechanisms:

1.  **JSON Data**: The code is written to handle missing fields gracefully (it assumes they are optional).
2.  **SQL Database**: We have disabled "auto-alter" to prevent data corruption. Instead, we added **Automatic Migrations** in `server/models/index.js`.
    -   When the server starts, it checks if your database tables are missing any new columns (like `coordinates`).
    -   If missing, it **automatically adds them** without deleting your existing data.

**So, simply replacing the `server` folder (while keeping `data` and `uploads`) and restarting the server is safe and will automatically update your database structure.**
