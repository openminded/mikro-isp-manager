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
