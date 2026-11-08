const { createDigestAuthService } = require('../services/digestAuthService');
const { API_PATHS, DEFAULT_HEADERS } = require('../config/constants');

class AttendanceController {
  constructor() {
    this.getAttendanceWithNames = this.getAttendanceWithNames.bind(this);
  }

  // Helper to process multiple devices
  async processMultipleDevices(devices, operationCallback) {
    const results = await Promise.all(
      devices.map(async (device) => {
        try {
          const service = createDigestAuthService(device);
          const result = await operationCallback(service, device);
          return {
            device: device.name || device.ip,
            ip: device.address_ip,
            success: result.success,
            data: result.data,
            error: result.error,
            status: result.status
          };
        } catch (error) {
          return {
            device: device.name || device.address_ip,
            ip: device.address_ip,
            success: false,
            error: error.message
          };
        }
      })
    );

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      results: results
    };
  }

  // Get user information by employee numbers
  async getUserInfo(service, employeeNumbers) {
    try {
      if (!employeeNumbers || employeeNumbers.length === 0) {
        return {};
      }

      // Filter out "0" and get unique employee numbers
      const uniqueNumbers = [...new Set(employeeNumbers.filter(no => no !== "0"))];

      if (uniqueNumbers.length === 0) {
        return {};
      }

      const searchData = {
        UserInfoSearchCond: {
          searchID: "1",
          searchResultPosition: 0,
          maxResults: uniqueNumbers.length,
          EmployeeNoList: uniqueNumbers.map(no => ({ employeeNo: no }))
        }
      };

      const response = await service.post(API_PATHS.USER_SEARCH, searchData, DEFAULT_HEADERS);

      if (response.success && response.data && response.data.UserInfoSearch && response.data.UserInfoSearch.UserInfo) {
        const userMap = {};
        response.data.UserInfoSearch.UserInfo.forEach(user => {
          userMap[user.employeeNo] = user.name || 'Unknown';
        });
        return userMap;
      }

      return {};
    } catch (error) {
      console.error('Error fetching user info:', error);
      return {};
    }
  }

  // Main method to get attendance with names
  async getAttendanceWithNames(req, res) {
    try {
      const { devices, filters = {} } = req.body;

      const {
        searchResultPosition = 0,
        maxResults = 100,
        startTime = "2025-04-17T00:00:00+02:00",
        endTime = "2035-04-18T23:59:59+02:00",
        timeReverseOrder = false,
        eventAttribute = "other",
        employeeNoString = ""
      } = filters;

      console.log('Fetching attendance for', devices.length, 'devices with filters:', filters);

      if (!devices || !Array.isArray(devices) || devices.length === 0) {
        return res.status(400).json({
          error: 'Devices array is required and cannot be empty'
        });
      }

      // Build attendance search data
      const attendanceSearchData = {
        AcsEventCond: {
          searchID: "1",
          searchResultPosition: searchResultPosition,
          maxResults: maxResults,
          major: 5,
          minor: 0,
          startTime: startTime,
          endTime: endTime,
          timeReverseOrder: timeReverseOrder,
          eventAttribute: eventAttribute

        }
      };
      // Add employeeNoString only if it’s not empty or null
      if (employeeNoString !== "") {
        attendanceSearchData.AcsEventCond.employeeNoString = employeeNoString;
      }

      // Process all devices
      const result = await this.processMultipleDevices(
        devices,
        async (service, device) => {
          try {
            console.log(`Fetching attendance from ${device.address_ip}`);

            // 1. Get attendance events
            const attendanceResponse = await service.post(API_PATHS.ATTENDANCE_SEARCH, attendanceSearchData, DEFAULT_HEADERS);

            if (!attendanceResponse.success || !attendanceResponse.data || !attendanceResponse.data.AcsEvent) {
              return {
                success: false,
                error: attendanceResponse.error || 'No attendance data received',
                data: []
              };
            }

            const acsEvent = attendanceResponse.data.AcsEvent;

            if (!acsEvent.InfoList || !Array.isArray(acsEvent.InfoList)) {
              return {
                success: true,
                data: [],
                total: 0,
                hasMore: false
              };
            }

            // 2. Extract employee numbers from events
            const employeeNumbers = acsEvent.InfoList
              .map(event => event.employeeNoString)
              .filter(no => no && no !== "0"); // Filter out "0" and empty values

            // 3. Get user names for these employee numbers
            const userMap = await this.getUserInfo(service, employeeNumbers);

            // 4. Combine events with user names
            const eventsWithNames = acsEvent.InfoList.map(event => {
              const eventType = this.getEventTypeDescription(event.major, event.minor);

              return {
                employeeNo: event.employeeNoString,
                employeeName: userMap[event.employeeNoString] || 'Unknown',
                eventTime: event.time,
                eventType: eventType,
                doorNo: event.doorNo
              };
            });

            return {
              success: true,
              data: eventsWithNames,
              total: acsEvent.totalMatches || 0,
              returned: acsEvent.numOfMatches || 0,
              hasMore: acsEvent.responseStatusStrg === "MORE",
              searchPosition: searchResultPosition
            };

          } catch (error) {
            console.error(`Error processing device ${device.address_ip}:`, error);
            return {
              success: false,
              error: error.message,
              data: []
            };
          }
        }
      );


      res.json({
        operation: 'get_attendance_members',

        summary: {
          total_devices: result.total,
          successful_devices: result.successful,
          failed_devices: result.failed
        },
        results: result.results
      });

    } catch (error) {
      console.error('Error in getAttendanceWithNames:', error);
      res.status(500).json({
        error: 'Internal server error while fetching attendance',
        details: error.message
      });
    }
  }

  // Helper to get event type description
  getEventTypeDescription(major, minor) {
    const eventTypes = {
      '5-6': 'Access Granted',
      '5-49': 'Door Forced Open',
      '5-38': 'Access Control Event',
      '5-1': 'Door Forced Open',
      '5-2': 'Door Left Open',
      '5-3': 'Door Locked',
      '5-4': 'Door Unlocked'
    };

    return eventTypes[`${major}-${minor}`] || `Event ${major}-${minor}`;
  }







}

module.exports = new AttendanceController();