const { createDigestAuthService } = require('../services/digestAuthService');
const { log } = require('../utils/logger');

class HikvisionSystemController {
    constructor() {
        // Bind all methods to the instance
        this.syncTimeHikvision = this.syncTimeHikvision.bind(this);
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

    /**
     * Sync time on Hikvision devices (NTP or Manual)
     */
    async syncTimeHikvision(req, res) {
        try {
            let {
                devices,
                use_ntp = true,
                timezone = 'GMT+01:00',
                ntp_server = '8.8.8.8'
            } = req.body;

            if (!devices || !Array.isArray(devices) || devices.length === 0) {
                return res.status(400).json({
                    error: 'Devices array is required and cannot be empty'
                });
            }

            const delay_between_request = 50;

            const result = await this.processMultipleDevices(
                devices,
                async (service, device) => {

                    // ---------------- 1️⃣ SET TIME MODE ----------------
                    let timePayload;

                    if (use_ntp) {
                        timePayload = {
                            Time: {
                                timeMode: 'NTP',
                                timeZone: timezone
                            }
                        };
                    } else {
                        // ⚠️ Morocco local time (important)
                        const now = new Date()
                            .toLocaleString('sv-SE', { timeZone: 'Africa/Casablanca' })
                            .replace(' ', 'T');

                        timePayload = {
                            Time: {
                                timeMode: 'manual',
                                localTime: now,
                                timeZone: timezone
                            }
                        };
                    }

                    const timeRes = await service.rawPut(
                        `/ISAPI/System/time`,
                        timePayload
                    );

                    if (!timeRes.success) {
                        throw new Error(`Failed to set time: ${JSON.stringify(timeRes.data)}`);
                    }

                    await new Promise(resolve => setTimeout(resolve, delay_between_request));

                    // ---------------- 2️⃣ SET NTP SERVER ----------------
                    if (use_ntp) {
                        const ntpPayload = {
                            NTPServer: {
                                id: 1,
                                addressingFormatType: 'ipaddress',
                                ipAddress: ntp_server,
                                portNo: 123,
                                synchronizeInterval: 60
                            }
                        };

                        const ntpRes = await service.rawPut(
                            `/ISAPI/System/time/ntpServers/1`,
                            ntpPayload
                        );

                        if (!ntpRes.success) {
                            throw new Error(`Failed to set NTP: ${JSON.stringify(ntpRes.data)}`);
                        }

                        await new Promise(resolve => setTimeout(resolve, delay_between_request));
                    }

                    // ---------------- 3️⃣ (OPTIONAL) VERIFY ----------------
                    const currentTime = await service.get(`/ISAPI/System/time`);

                    return {
                        success: true,
                        data: {
                            ip: device.address_ip,
                            use_ntp,
                            timezone,
                            ntp_server: use_ntp ? ntp_server : null,
                            current_time: currentTime?.data ?? null
                        }
                    };
                }
            );

            return res.json({
                operation: 'sync_hikvision_time',
                use_ntp,
                timezone,
                summary: result
            });

        } catch (error) {
            log.error(error.message, error, {});
            return res.status(500).json({
                error: 'Internal server error',
                details: error.message
            });
        }
    }

}

module.exports = new HikvisionSystemController();

