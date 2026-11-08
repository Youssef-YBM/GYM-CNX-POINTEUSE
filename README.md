# GYM CNX Pointeuse

A middleware service that connects the GYMYA gym management system to Hikvision access control devices, designed to run on Raspberry Pi.

## 🚀 Features

- **Member Management**: Add, update, delete, and retrieve gym members on Hikvision devices
- **Real-time Communication**: Direct API integration with Hikvision ISAPI
- **Raspberry Pi Optimized**: Designed for deployment on Raspberry Pi devices
- **Robust Error Handling**: Comprehensive error handling and retry mechanisms
- **Security**: Rate limiting, CORS, and input validation
- **Logging**: Structured logging with Winston
- **Health Monitoring**: Built-in health checks and connection testing

## 📋 Prerequisites

- Node.js 16+ and npm 8+
- Raspberry Pi with network access
- Hikvision access control device on the same network
- Valid credentials for the Hikvision device

## 🛠️ Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd gym-cnx-pointeuse
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
```bash
cp .env.example .env
# Edit .env with your Hikvision device details
```

### 4. Configure your `.env` file
```env
# Hikvision Device Configuration
POINTEUSE_IP=192.168.1.100
POINTEUSE_USER=admin
POINTEUSE_PASS=your_secure_password

# Server Configuration
PORT=3000
NODE_ENV=production

# Logging Configuration
LOG_LEVEL=info
LOG_FILE_PATH=./logs

# Security Configuration
API_RATE_LIMIT=100
API_RATE_WINDOW=900000

# Hikvision API Configuration
HIKVISION_TIMEOUT=10000
HIKVISION_RETRY_ATTEMPTS=1
HIKVISION_RETRY_DELAY=1000
```

## 🚀 Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## 📚 Complete API Documentation

### 🏥 Health Check Endpoints

#### Main Service Health
```bash
GET /health
```
**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "service": "gym-cnx-pointeuse",
  "version": "1.0.0",
  "timestamp": "2024-01-09T12:00:00.000Z",
  "uptime": 3600
}
```

#### Single Device Service Health
```bash
GET /api/hikvision/health
```
**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "hikvision_connected": true,
  "timestamp": "2024-01-09T12:00:00.000Z"
}
```

#### Multi-Device Service Health
```bash
GET /api/hikvision/multi/health
```
**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "service": "gymya-multi-device-hikvision",
  "version": "1.0.0",
  "timestamp": "2024-01-09T12:00:00.000Z",
  "uptime": 3600,
  "endpoints": {
    "test-device": "POST /api/hikvision/multi/test-device",
    "add-to-device": "POST /api/hikvision/multi/add-to-device",
    "add-to-multiple": "POST /api/hikvision/multi/add-to-multiple",
    "update-on-device": "PUT /api/hikvision/multi/update-on-device",
    "delete-from-device": "DELETE /api/hikvision/multi/delete-from-device",
    "get-from-device": "POST /api/hikvision/multi/get-from-device",
    "search-across-devices": "POST /api/hikvision/multi/search-across-devices"
  }
}
```

---

### 🔧 Single Device Management (`/api/hikvision`)

#### Add User
```bash
POST /api/hikvision/add
Content-Type: application/json

{
  "employeeNo": "EMP001",
  "name": "John Doe",
  "userType": "normal",
  "beginTime": "2024-01-01T00:00:00",
  "endTime": "2024-12-31T23:59:59",
  "doors": [1, 2]
}
```
**Response:**
```json
{
  "success": true,
  "data": {...},
  "message": "User John Doe added successfully"
}
```

#### Update User
```bash
PUT /api/hikvision/update
Content-Type: application/json

{
  "employeeNo": "EMP001",
  "name": "John Doe Updated",
  "userType": "normal",
  "beginTime": "2024-01-01T00:00:00",
  "endTime": "2024-12-31T23:59:59",
  "doors": [1, 2, 3]
}
```
**Response:**
```json
{
  "success": true,
  "data": {...},
  "message": "User John Doe Updated updated successfully"
}
```

#### Delete User
```bash
DELETE /api/hikvision/delete
Content-Type: application/json

{
  "employeeNo": "EMP001"
}
```
**Response:**
```json
{
  "success": true,
  "data": {...},
  "message": "User EMP001 deleted successfully"
}
```

#### Get User by ID
```bash
GET /api/hikvision/get/EMP001
```
**Response:**
```json
{
  "success": true,
  "data": {
    "UserInfo": {
      "employeeNo": "EMP001",
      "name": "John Doe",
      "userType": "normal",
      "valid": {
        "enable": true,
        "beginTime": "2024-01-01T00:00:00",
        "endTime": "2024-12-31T23:59:59"
      },
      "doorRight": [1, 2]
    }
  },
  "message": "User EMP001 fetched successfully"
}
```

#### Get All Users
```bash
GET /api/hikvision/all
```
**Response:**
```json
{
  "success": true,
  "data": {
    "UserInfoSearch": {
      "UserInfo": [
        {
          "employeeNo": "EMP001",
          "name": "John Doe",
          "userType": "normal"
        },
        {
          "employeeNo": "EMP002", 
          "name": "Jane Smith",
          "userType": "normal"
        }
      ]
    }
  },
  "message": "Users fetched successfully"
}
```

#### Test Connection
```bash
GET /api/hikvision/test
```
**Response:**
```json
{
  "success": true,
  "connected": true,
  "message": "Connected to Hikvision device"
}
```

---

### 🌐 Multi-Device Management (`/api/hikvision/multi`)

#### Test Device Connection
```bash
POST /api/hikvision/multi/test-device
Content-Type: application/json

{
  "ip": "192.168.1.100",
  "user": "admin",
  "pass": "password123",
  "name": "Main Entrance"
}
```
**Response:**
```json
{
  "success": true,
  "device": "Main Entrance",
  "ip": "192.168.1.100",
  "deviceInfo": {
    "deviceName": "Hikvision Access Control",
    "firmwareVersion": "V4.1.0"
  }
}
```

#### Add User to Specific Device
```bash
POST /api/hikvision/multi/add-to-device
Content-Type: application/json

{
  "device": {
    "ip": "192.168.1.100",
    "user": "admin",
    "pass": "password123",
    "name": "Main Entrance"
  },
  "member": {
    "employeeNo": "EMP001",
    "name": "John Doe",
    "userType": "normal",
    "beginTime": "2024-01-01T00:00:00",
    "endTime": "2024-12-31T23:59:59",
    "doors": [1]
  }
}
```
**Response:**
```json
{
  "success": true,
  "device": "Main Entrance",
  "ip": "192.168.1.100",
  "data": {...},
  "message": "User John Doe added successfully to Main Entrance"
}
```

#### Add User to Multiple Devices
```bash
POST /api/hikvision/multi/add-to-multiple
Content-Type: application/json

{
  "devices": [
    {
      "ip": "192.168.1.100",
      "user": "admin",
      "pass": "password123",
      "name": "Main Entrance"
    },
    {
      "ip": "192.168.1.101",
      "user": "admin",
      "pass": "password456",
      "name": "Back Door"
    },
    {
      "ip": "192.168.1.102",
      "user": "admin",
      "pass": "password789",
      "name": "Gym Floor"
    }
  ],
  "member": {
    "employeeNo": "EMP001",
    "name": "John Doe",
    "userType": "normal",
    "beginTime": "2024-01-01T00:00:00",
    "endTime": "2024-12-31T23:59:59",
    "doors": [1]
  }
}
```
**Response:**
```json
{
  "success": true,
  "total": 3,
  "successful": 2,
  "failed": 1,
  "results": {
    "successful": [
      {
        "success": true,
        "device": "Main Entrance",
        "ip": "192.168.1.100",
        "message": "User John Doe added successfully to Main Entrance"
      },
      {
        "success": true,
        "device": "Back Door",
        "ip": "192.168.1.101",
        "message": "User John Doe added successfully to Back Door"
      }
    ],
    "failed": [
      {
        "success": false,
        "device": "Gym Floor",
        "ip": "192.168.1.102",
        "error": "Connection timeout",
        "message": "Failed to add user John Doe to Gym Floor: Connection timeout"
      }
    ]
  },
  "message": "User John Doe added to 2/3 devices"
}
```

#### Update User on Specific Device
```bash
PUT /api/hikvision/multi/update-on-device
Content-Type: application/json

{
  "device": {
    "ip": "192.168.1.100",
    "user": "admin",
    "pass": "password123",
    "name": "Main Entrance"
  },
  "member": {
    "employeeNo": "EMP001",
    "name": "John Doe Updated",
    "userType": "normal",
    "beginTime": "2024-01-01T00:00:00",
    "endTime": "2024-12-31T23:59:59",
    "doors": [1, 2]
  }
}
```
**Response:**
```json
{
  "success": true,
  "device": "Main Entrance",
  "ip": "192.168.1.100",
  "data": {...},
  "message": "User John Doe Updated updated successfully on Main Entrance"
}
```

#### Delete User from Specific Device
```bash
DELETE /api/hikvision/multi/delete-from-device
Content-Type: application/json

{
  "device": {
    "ip": "192.168.1.100",
    "user": "admin",
    "pass": "password123",
    "name": "Main Entrance"
  },
  "employeeNo": "EMP001"
}
```
**Response:**
```json
{
  "success": true,
  "device": "Main Entrance",
  "ip": "192.168.1.100",
  "data": {...},
  "message": "User EMP001 deleted successfully from Main Entrance"
}
```

#### Get User from Specific Device
```bash
POST /api/hikvision/multi/get-from-device
Content-Type: application/json

{
  "device": {
    "ip": "192.168.1.100",
    "user": "admin",
    "pass": "password123",
    "name": "Main Entrance"
  },
  "employeeNo": "EMP001"
}
```
**Response:**
```json
{
  "success": true,
  "device": "Main Entrance",
  "ip": "192.168.1.100",
  "data": {
    "UserInfo": {
      "employeeNo": "EMP001",
      "name": "John Doe",
      "userType": "normal",
      "valid": {
        "enable": true,
        "beginTime": "2024-01-01T00:00:00",
        "endTime": "2024-12-31T23:59:59"
      },
      "doorRight": [1]
    }
  },
  "message": "User EMP001 fetched successfully from Main Entrance"
}
```

#### Search User Across Multiple Devices
```bash
POST /api/hikvision/multi/search-across-devices
Content-Type: application/json

{
  "devices": [
    {
      "ip": "192.168.1.100",
      "user": "admin",
      "pass": "password123",
      "name": "Main Entrance"
    },
    {
      "ip": "192.168.1.101",
      "user": "admin",
      "pass": "password456",
      "name": "Back Door"
    },
    {
      "ip": "192.168.1.102",
      "user": "admin",
      "pass": "password789",
      "name": "Gym Floor"
    }
  ],
  "employeeNo": "EMP001"
}
```
**Response:**
```json
{
  "success": true,
  "employeeNo": "EMP001",
  "found": 2,
  "notFound": 1,
  "errors": 0,
  "results": {
    "found": [
      {
        "success": true,
        "device": "Main Entrance",
        "ip": "192.168.1.100",
        "data": {...},
        "message": "User EMP001 fetched successfully from Main Entrance"
      },
      {
        "success": true,
        "device": "Back Door",
        "ip": "192.168.1.101",
        "data": {...},
        "message": "User EMP001 fetched successfully from Back Door"
      }
    ],
    "notFound": [
      {
        "success": false,
        "device": "Gym Floor",
        "ip": "192.168.1.102",
        "error": "User not found",
        "message": "User EMP001 not found on Gym Floor"
      }
    ],
    "errors": []
  },
  "message": "User EMP001 found on 2/3 devices"
}
```

---

### 📝 Field Descriptions

#### Member Fields:
- `employeeNo`: Employee ID (required, 1-50 characters)
- `name`: Full name (required, 1-100 characters)
- `userType`: "normal", "blacklist", or "visitor" (optional, default: "normal")
- `beginTime`: Access start time (optional, format: "YYYY-MM-DDTHH:mm:ss")
- `endTime`: Access end time (optional, format: "YYYY-MM-DDTHH:mm:ss")
- `doors`: Array of door numbers (optional, default: [1])

#### Device Fields:
- `ip`: Device IP address (required, valid IP format)
- `user`: Device username (required)
- `pass`: Device password (required)
- `name`: Device friendly name (optional)

### 🎯 Quick Test Commands (PowerShell)

#### Health Checks
```powershell
# Main service
Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing

# Single device service
Invoke-WebRequest -Uri "http://localhost:3000/api/hikvision/health" -UseBasicParsing

# Multi-device service
Invoke-WebRequest -Uri "http://localhost:3000/api/hikvision/multi/health" -UseBasicParsing
```

#### Add User to Single Device
```powershell
$body = @{
    employeeNo = "EMP001"
    name = "John Doe"
    userType = "normal"
    doors = @(1, 2)
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/hikvision/add" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
```

#### Test Multi-Device Connection
```powershell
$body = @{
    ip = "192.168.1.100"
    user = "admin"
    pass = "password123"
    name = "Main Entrance"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/hikvision/multi/test-device" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
```

## 🔧 Raspberry Pi Deployment

### 1. Install Node.js on Raspberry Pi
```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Deploy the application
```bash
# Clone and install
git clone <repository-url>
cd gym-cnx-pointeuse
npm install --production

# Create .env file
cp .env.example .env
# Edit with your configuration
```

### 3. Run as a systemd service
```bash
# Copy service file
sudo cp systemd/gymya-connect.service /etc/systemd/system/

# Edit the service file with correct paths
sudo nano /etc/systemd/system/gymya-connect.service

# Enable and start the service
sudo systemctl enable gymya-connect
sudo systemctl start gymya-connect

# Check status
sudo systemctl status gymya-connect
```

### 4. Alternative: Using PM2
```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the application
pm2 start src/index.js --name "gymya-hikvision"

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

## 🔍 Monitoring and Logs

### Log Files
- `logs/combined.log` - All application logs
- `logs/error.log` - Error logs only
- `logs/exceptions.log` - Uncaught exceptions

### Health Monitoring
```bash
# Check service health
curl http://localhost:3000/health

# Check Hikvision connection
curl http://localhost:3000/api/hikvision/test
```

### Log Monitoring
```bash
# View real-time logs
tail -f logs/combined.log

# View error logs only
tail -f logs/error.log
```

## 🛡️ Security Considerations

- Change default Hikvision device credentials
- Use strong passwords for device access
- Configure firewall to restrict access to the API
- Regularly update dependencies
- Monitor logs for suspicious activity

## 🐛 Troubleshooting

### Common Issues

1. **Cannot connect to Hikvision device**
   - Verify IP address and credentials
   - Check network connectivity
   - Ensure device supports ISAPI

2. **Rate limit exceeded**
   - Adjust `API_RATE_LIMIT` in `.env`
   - Check for multiple requests

3. **Service won't start**
   - Check Node.js version (requires 16+)
   - Verify all dependencies are installed
   - Check log files for errors

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug npm start
```

## 📊 Performance

- Handles up to 100 requests per 15 minutes (configurable)
- Automatic retry mechanism for failed requests
- Connection pooling for better performance
- Optimized for Raspberry Pi resources

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the troubleshooting section
- Review log files for error details
- Ensure Hikvision device configuration is correct
