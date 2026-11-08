module.exports = {
  API_PATHS: {
    USER_SEARCH: '/ISAPI/AccessControl/UserInfo/Search?format=json',
    USER_RECORD: '/ISAPI/AccessControl/UserInfo/Record?format=json',
    USER_DELETE: '/ISAPI/AccessControl/UserInfo/Delete?format=json',
    USER_UPDATE: '/ISAPI/AccessControl/UserInfo/Modify?format=json',
    USER_DETAILS: '/ISAPI/AccessControl/UserInfo/Record?format=json', // For getting single user

    //FACE_SETUP_INTELLIGENT: '/ISAPI/Intelligent/FDLib/FDSetUp?format=json',
    FACE_DATA_RECORD: '/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json',
    FACE_DATA_DELETE: '/ISAPI/Intelligent/FDLib/FDSearch/Delete?format=json',
    FACE_DATA_UPDATE: '/ISAPI/AccessControl/FaceData/Modify?format=json',

    CARD_RECORD: '/ISAPI/AccessControl/CardInfo/Record?format=json',
    CARD_DELETE: '/ISAPI/AccessControl/CardInfo/Delete?format=json',
    CARD_UPDATE: '/ISAPI/AccessControl/CardInfo/Modify?format=json',

    // Attendance and Event paths
    ATTENDANCE_SEARCH: '/ISAPI/AccessControl/AcsEvent?format=json'
  },
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json'
  },
  DEFAULT_VALUES: {
    USER_TYPE: 'normal',
    BEGIN_TIME: '2000-01-01T00:00:00',
    END_TIME: '2037-12-31T23:59:59'
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs'
  },
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT) || 3000,
    env: process.env.NODE_ENV || 'development',
    rateLimit: {
      max: parseInt(process.env.API_RATE_LIMIT) || 100,
      windowMs: parseInt(process.env.API_RATE_WINDOW) || 15 * 60 * 1000 // 15 minutes
    }
  },
  BACKEND_API: {
    ENDPOINT: process.env.BACKEND_API || 'http://127.0.0.1:8000',
  }
};