# LifeOS Complete Deployment Guide (AWS EC2 & Frontend)

This guide provides a comprehensive, step-by-step procedure for deploying the LifeOS backend to an AWS EC2 instance, and setting up your frontend. 

---

## Part 1: AWS Backend Deployment

### Step 1: Connect to your AWS EC2 Instance
I found your key file on your computer! It is saved at:
`C:\Users\Gaurav Patel\Downloads\lifeos-key.pem`

#### Method A: Connect from PowerShell / Command Prompt (Recommended)
Copy and paste this exact command into your terminal:
```powershell
ssh -i "C:\Users\Gaurav Patel\Downloads\lifeos-key.pem" ubuntu@16.171.242.175
```
*(Note: When it asks `Are you sure you want to continue connecting (yes/no/[fingerprint])?`, type `yes` and hit Enter).*

> [!NOTE]
> If your instance is running Amazon Linux instead of Ubuntu, the username is `ec2-user`:
> `ssh -i "C:\Users\Gaurav Patel\Downloads\lifeos-key.pem" ec2-user@16.171.242.175`

#### Method B: Connect directly in AWS Browser Console (No terminal key needed!)
If you ever don't have the key or encounter key errors:
1. Log in to [AWS Console](https://console.aws.amazon.com/ec2/).
2. Go to **EC2** -> **Instances**.
3. Select your instance (`16.171.242.175`).
4. Click the orange **Connect** button at the top right.
5. Under **EC2 Instance Connect**, click the orange **Connect** button at the bottom.
6. A black terminal window will open right inside your browser!

### Step 2: Install Docker & Docker Compose (If not already installed)
Once connected to the AWS terminal, update the system and install Docker:
```bash
sudo apt-get update -y
sudo apt-get install docker.io docker-compose -y

# Start Docker and enable it to run on boot
sudo systemctl start docker
sudo systemctl enable docker

# Give your user permission to run docker without typing "sudo" every time
sudo usermod -aG docker $USER
newgrp docker
```

### Step 3: Get Your Code on the Server
You need to clone your repository to the AWS server. 
```bash
# Clone the repository (replace with your actual git URL)
git clone https://github.com/gauravpatel007/Healthcare-Ai-Mobile.git

# Enter the project directory
cd Healthcare-Ai-Mobile
```

### Step 4: Configure the Environment Variables
You need to create the `.env` file on the server.
```bash
# Copy the example environment file
cp .env.example .env

# Open the file using the nano text editor
nano .env
```
Inside the `nano` editor, paste or write all of your API keys (Twilio, Groq, database credentials, etc.). 
- **Important**: Make sure `PUBLIC_API_URL` is set to `http://16.171.242.175:8000`.
- Once finished, save the file by pressing `Ctrl + O`, hit `Enter`, and exit with `Ctrl + X`.

### Step 5: Start the Backend Server
Now that everything is set up, build and start the Docker containers in detached mode:
```bash
docker-compose up -d --build
```
Your backend will now start running on port `8000`.

### Step 6: Verify Backend is Running
To check that the backend is working correctly without errors, view the logs:
```bash
docker-compose logs -f app
```
*(Press `Ctrl+C` to exit the logs).*

### Step 7: Open AWS Security Group Ports
For the internet (and Twilio) to reach your backend, you **must** open Port `8000` in your AWS dashboard.
1. Go to your AWS EC2 Console.
2. Select your instance and click on the **Security** tab.
3. Click on the Security Group attached to the instance.
4. Click **Edit inbound rules**.
5. Add a new rule: 
   - Type: **Custom TCP**
   - Port Range: **8000**
   - Source: **Anywhere-IPv4 (0.0.0.0/0)**
6. Save the rules.

---

## Part 2: Frontend Deployment (Web & Mobile)

The frontend is a React application powered by Vite and Capacitor.

### Step 1: Install Dependencies
On your local machine (not AWS), open a new terminal, navigate to the frontend directory, and install the npm packages:
```bash
cd "frontend-react"
npm install
```

### Step 2: Configure Frontend API URL
Ensure your frontend is pointing to your newly deployed AWS server. Open your frontend `.env` file or API configuration file and set the base URL:
```javascript
VITE_API_BASE_URL="http://16.171.242.175:8000/api/v1"
```

### Step 3: Run for Local Development
To start the Vite development server (which will give you a local URL like `http://localhost:5173`):
```bash
npm run dev
```

### Step 4: Build for Production (Web)
To create an optimized production build of the website:
```bash
npm run build
```
*(You can upload the contents of the `dist` folder to platforms like Vercel, Netlify, or AWS S3).*

### Step 5: Build for Android (Mobile)
If you are deploying the Android app via Capacitor, run:
```bash
npm run build:android
```
Afterward, you can open the project in Android Studio to run it on an emulator or build the final `.apk`:
```bash
npx cap open android
```
