const { createDigestAuthService } = require('../services/digestAuthService');
const { log } = require('../utils/logger');
const xml2js = require('xml2js');
class ShiftsController {
    constructor() {
        // Bind all methods to the instance
        this.syncHikvision = this.syncHikvision.bind(this);
        
        this.processMultipleDevices = this.processMultipleDevices.bind(this);
    }

    // Helper method to process multiple devices in parallel
    async processMultipleDevices(devices, operationCallback) {
        const results = await Promise.all(
            devices.map(async (device) => {
                try {
                    // Create authentication service
                    const service = createDigestAuthService(device);
                    const result = await operationCallback(service, device);
                    return {
                        pivot_member_pointeuse_id: device.pivot_member_pointeuse_id ?? null,
                        pointeuse_id: device.pointeuse_id,
                        device: device.name || device.address_ip,
                        ip: device.address_ip,
                        success: result?.success ?? false,
                        data: result?.data ?? null
                    };
                } catch (error) {
                    log.error(error.message, error, {});
                    return {
                        pivot_member_pointeuse_id: device.pivot_member_pointeuse_id ?? null,
                        pointeuse_id: device.pointeuse_id,
                        device: device.name || device.address_ip,
                        ip: device.address_ip,
                        success: false,
                        error: error.message
                    };
                }
            })
        );

        const successful = results.filter(r => r?.success);
        const failed = results.filter(r => !r?.success);

        return {
            total: results.length,
            successful: successful.length,
            failed: failed.length,
            results: results
        };
    }

    // Sync Hikvision shift/access control plan
    async syncHikvision(req, res) {
        try {
            let {
                devices,
                templateName,
                planTemplateID,
                weekPlanID,
                enable,
                weekSchedule  // New structure: { "Monday": [{ beginTime, endTime }, ...], ... }
            } = req.body;

            // Support backward compatibility with old format
            const {
                beginTime,
                endTime,
                week
            } = req.body;

            if (!devices || !Array.isArray(devices) || devices.length === 0) {
                return res.status(400).json({
                    error: 'Devices array is required and cannot be empty'
                });
            }

            if (!templateName) {
                return res.status(400).json({
                    error: 'Missing required parameters:  templateName'
                });
            }


            // Validate time format (HH:mm:ss)
            const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
            const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

            let scheduleData = {};

            // Check if using new format (weekSchedule) or old format (week + beginTime + endTime)
            if (weekSchedule && typeof weekSchedule === 'object') {
                // New format: weekSchedule with multiple shifts per day
                for (const [dayName, shifts] of Object.entries(weekSchedule)) {
                    if (!validDays.includes(dayName)) {
                        return res.status(400).json({
                            error: `Invalid day name: ${dayName}. Valid days are: ${validDays.join(', ')}`
                        });
                    }

                    if (!Array.isArray(shifts) || shifts.length === 0) {
                        return res.status(400).json({
                            error: `${dayName} must have at least one shift with beginTime and endTime`
                        });
                    }

                    scheduleData[dayName] = shifts.map((shift, index) => {
                        if (!shift.beginTime || !shift.endTime) {
                            throw new Error(`${dayName} shift ${index + 1} must have beginTime and endTime`);
                        }
                        if (!timeRegex.test(shift.beginTime) || !timeRegex.test(shift.endTime)) {
                            throw new Error(`${dayName} shift ${index + 1}: beginTime and endTime must be in format HH:mm:ss`);
                        }
                        return {
                            beginTime: shift.beginTime,
                            endTime: shift.endTime,
                            authenticationTimesEnabled: shift.authenticationTimesEnabled,
                            authenticationTimes: shift.authenticationTimes,
                        };
                    });
                }
            } else if (week && beginTime && endTime) {
                // Old format: backward compatibility - single shift for all days
                if (!Array.isArray(week) || week.length === 0) {
                    return res.status(400).json({
                        error: 'week must be a non-empty array'
                    });
                }

                if (!timeRegex.test(beginTime) || !timeRegex.test(endTime)) {
                    return res.status(400).json({
                        error: 'beginTime and endTime must be in format HH:mm:ss (e.g., "08:00:00")'
                    });
                }

                const invalidDays = week.filter(day => !validDays.includes(day));
                if (invalidDays.length > 0) {
                    return res.status(400).json({
                        error: `Invalid day names: ${invalidDays.join(', ')}. Valid days are: ${validDays.join(', ')}`
                    });
                }

                // Convert old format to new format
                week.forEach(dayName => {
                    scheduleData[dayName] = [{ beginTime, endTime, authenticationTimesEnabled, authenticationTimes }];
                });
            } else {
                return res.status(400).json({
                    error: 'Either provide weekSchedule (new format) or week + beginTime + endTime (old format)'
                });
            }

            const delay_between_request = 50; // Delay between API requests (ms)
 
            const result = await this.processMultipleDevices(
                devices,
                async (service, device) => {
                    // ---------------- 1️⃣ GET capabilities ----------------
                    const capabilities = await service.get('/ISAPI/AccessControl/capabilities');
                    let jsonCapabilities = null
                    // xml2js options
                    const parser = new xml2js.Parser({
                        explicitArray: false,   // no arrays for single elements
                        ignoreAttrs: false,     // keep attributes
                        mergeAttrs: true,       // merge attributes into object
                        trim: true
                    });

                    parser.parseString(capabilities?.data, (err, result) => {
                        if (err) {
                            console.error('XML Parse Error:', err);
                            return;
                        }

                        // Convert string "true"/"false" to boolean
                        jsonCapabilities = JSON.parse(
                            JSON.stringify(result, (key, value) => {
                                if (value === 'true') return true;
                                if (value === 'false') return false;
                                return value;
                            })
                        );


                    });

                    if (!jsonCapabilities?.AccessControl?.isSupportUserRightPlanTemplate) {
                        throw new Error('Device does NOT support UserRightPlanTemplate');
                    }

                    await new Promise(resolve => setTimeout(resolve, delay_between_request));

                    // ---------------- 2️⃣ Get existing WeekPlans ----------------
                    //weekPlanID == weekPlanNo

                    const existingWeekPlans = await service.get(`/ISAPI/AccessControl/UserRightWeekPlanCfg/${weekPlanID}?format=json`);
 

                    if (existingWeekPlans?.data?.UserRightWeekPlanCfg && !existingWeekPlans?.data?.UserRightWeekPlanCfg?.enable) {
                        weekPlanID = weekPlanID
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, delay_between_request));

                    // ---------------- 3️⃣ Create/Update WeekPlan ----------------
                    // Convert scheduleData to WeekPlanCfg format
                    // Hikvision supports multiple TimeSegments per day (as an array)
                    const weekPlanCfg = [];
                    let dayIndex = 1;

                    for (const [dayName, shifts] of Object.entries(scheduleData)) {
                        dayIndex = 1;
                        // Convert shifts to TimeSegment format
                        // Hikvision supports TimeSegment as array for multiple segments per day
                        shifts.forEach((element, indexShift) => {
                          
                            weekPlanCfg.push({
                                week: dayName,
                                id: dayIndex++,
                                enable: enable,
                                // Use array format for TimeSegment (works for both single and multiple segments)
                                TimeSegment: {
                                    beginTime: element.beginTime,
                                    endTime: element.endTime
                                },
                                authenticationTimesEnabled: true, //element.authenticationTimesEnabled ?? false,
                                authenticationTimes: element?.authenticationTimes ?? 0
                            });
                        }); 


                    }

                    const weekPlanPayload = {
                        "UserRightWeekPlanCfg": {
                            "enable": enable,
                            "WeekPlanCfg": weekPlanCfg
                        }
                    };
                   
                    const weekPlanRes = await service.rawPut(
                        `/ISAPI/AccessControl/UserRightWeekPlanCfg/${weekPlanID}?format=json`,
                        weekPlanPayload
                    );
                   
                    if (!weekPlanRes.success) {
                        throw new Error(`Failed to create/update WeekPlan: ${JSON.stringify(weekPlanRes.data)}`);
                    }

                    await new Promise(resolve => setTimeout(resolve, delay_between_request));

                    // ---------------- 4️⃣ Get existing PlanTemplates ----------------
                    // planTemplateID == Schedule template No == planTemplateNo

                    const existingTemplates = await service.get(`/ISAPI/AccessControl/UserRightPlanTemplate/${planTemplateID}?format=json`);
                  
                    if (existingTemplates.data?.UserRightPlanTemplate) {
                        if (!existingTemplates.data?.UserRightPlanTemplate?.enable && existingTemplates.data?.UserRightPlanTemplate?.weekPlanNo === 0) {
                            planTemplateID = planTemplateID
                        }
                        // Check if template with same name already exists
                        if (existingTemplates.data.UserRightPlanTemplate.templateName === templateName) {
                            console.log("template name existe")
                        }
                    }
                    await new Promise(resolve => setTimeout(resolve, delay_between_request));

                    // ---------------- 5️⃣ Create/Update PlanTemplate ----------------
                    const templatePayload = {
                        "UserRightPlanTemplate": {
                            enable: enable,
                            templateName: templateName,
                            weekPlanNo: weekPlanID,
                            holidayGroupNo: ""
                        }
                    }; 
                    const templateRes = await service.rawPut(
                        `/ISAPI/AccessControl/UserRightPlanTemplate/${planTemplateID}?format=json`,
                        templatePayload
                    );

                    if (!templateRes.success) {
                        throw new Error(`Failed to create/update PlanTemplate: ${JSON.stringify(templateRes.data)}`);
                    }   
 

                    return {
                        success: true,
                        data: {
                            templateName: templateName,
                            planTemplateID: planTemplateID,
                            weekPlanID: weekPlanID,
                            weekSchedule: weekSchedule, 
                        }
                    };
                }
            );

            res.json({
                operation: 'sync_hikvision_shift',
                templateName,
                summary: result
            });

        } catch (error) {
            log.error(error.message, error, {});
            res.status(500).json({
                error: 'Internal server error',
                details: error.message
            });
        }
    }
 
}

module.exports = new ShiftsController();

