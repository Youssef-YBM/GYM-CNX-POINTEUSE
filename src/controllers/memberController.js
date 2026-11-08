const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const http = require('http');
const path = require('path');


const { createDigestAuthService } = require('../services/digestAuthService');

const { API_PATHS, DEFAULT_VALUES, BACKEND_API } = require('../config/constants');
const { log } = require('../utils/logger');

process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION:', err);
});

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

class MemberController {
    constructor() {
        // Bind all methods to the instance 
        this.processMultipleDevices = this.processMultipleDevices.bind(this);
        this.formatMemberData = this.formatMemberData.bind(this); // Add this line

        // routes
        this.addOrEditMember = this.addOrEditMember.bind(this);
        this.deleteMember = this.deleteMember.bind(this);
        this.deleteMembersBySubscriptionStatus = this.deleteMembersBySubscriptionStatus.bind(this);
        this.syncMembersViaFileJson = this.syncMembersViaFileJson.bind(this);
        this.checkMemberIfExiste = this.checkMemberIfExiste.bind(this)
        // just to check capabilities pointeuses
        this.checkCapabilities = this.checkCapabilities.bind(this);

        // Methods  
        this.uploadFaceWithRetry = this.uploadFaceWithRetry.bind(this);
        this.deleteFace = this.deleteFace.bind(this);
        this.deleteEmployeNo = this.deleteEmployeNo.bind(this);
        this.deleteCardNo = this.deleteCardNo.bind(this);

    }

    // Helper method to process multiple devices in parallel
    // Helper method to process multiple devices in parallel
    async processMultipleDevices(devices, operationCallback) {
        const results = await Promise.allSettled( // Use allSettled instead of all
            devices.map(async (device) => {
                try {
                    // Create authentication service
                    let service = createDigestAuthService(device);


                    const result = await operationCallback(service, device);

                    return {
                        pointeuse_id: device?.pointeuse_id ?? null,
                        ip: device.address_ip,
                        success: result?.success === true,
                        faceUploadSuccess: result?.faceUploadSuccess ?? false,
                        error: null
                    };
                } catch (error) {

                    log.error(`Error processing device ${device.address_ip}: ${error.message}`, error);
                    return {
                        pointeuse_id: device.pointeuse_id,
                        ip: device.address_ip,
                        success: false,
                        faceUploadSuccess: false,
                        error: error.message
                    };
                }
            })
        );
        const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success);
        const failed = results.filter(r => r.status === 'rejected' || !r.value?.success);

        return {
            total: devices.length,
            successful: successful.length,
            failed: failed.length,
            results: results.map(r => r.status === 'fulfilled' ? r.value : {
                success: false,
                error: r.reason?.message || 'Unknown error'
            })
        };
    }


    // Format member data according to device requirements
    formatMemberData(member) {
        const memberData = {
            UserInfo: {
                employeeNo: member.employeeNo,
                name: member.name,
                userType: member.userType || DEFAULT_VALUES.USER_TYPE,
                Valid: {
                    enable: member.enable,
                    beginTime: member.beginTime || DEFAULT_VALUES.BEGIN_TIME,
                    endTime: member.endTime || DEFAULT_VALUES.END_TIME,
                    timeType: 'local'
                }
            }
        };
        // Add optional fields if provided
        if (member.cardNo) {
            memberData.UserInfo.cardNo = member.cardNo;
        }
        if (member.cardType) {
            memberData.UserInfo.cardType = member.cardType;
        }

        if (member.faceList && typeof member.faceList === 'object') {
            memberData.UserInfo.faceList = member.faceList;
        }

        if (member.doors && Array.isArray(member.doors)) {
            memberData.UserInfo.doorRight = member.doors;
        }

        if (member?.password) {
            memberData.UserInfo.password = member.password;
        }

        if (member.gender) {
            memberData.UserInfo.gender = member.gender;
        }
        if (member.doorRight) {
            memberData.UserInfo.doorRight = member.doorRight;
        }

        if (member.RightPlan) {
            memberData.UserInfo.RightPlan = member.RightPlan;
        }

        // if (member?.groupId) {
        //     memberData.UserInfo.groupId = member.groupId;
        // }
        // if (member?.roomNumber) {
        //     memberData.UserInfo.roomNumber = member.roomNumber;
        // }

        // if (member?.floorNumber) {
        //     memberData.UserInfo.floorNumber = member.floorNumber;
        // }
        // if (member?.phoneNumber) {
        //     memberData.UserInfo.phoneNo = member.phoneNumber;
        // }

        // if (member?.email) {
        //     memberData.UserInfo.email = member.email;
        // }
        // // Add any other custom fields
        // if (member.customFields) {
        //     Object.assign(memberData.UserInfo, member.customFields);
        // }
console.log(memberData);
        return memberData;
    }



    // Update member on multiple devices
    async addOrEditMember(req, res) {
        try {
            const delay_between_request = 350;
            const { devices, member } = req.body;

            if (!devices || !Array.isArray(devices) || devices.length === 0) {
                return res.status(400).json({
                    error: 'Devices array is required and cannot be empty'
                });
            }

            if (!member || !member.employeeNo) {
                return res.status(400).json({
                    error: 'Member data with employeeNo is required'
                });
            }

            // Format member data according to device requirements
            const formattedMemberData = this.formatMemberData(member);

            const result = await this.processMultipleDevices(
                devices,
                async (service, device) => {
                    try {

                        // Check if member exists
                        const exists = await this.checkMemberIfExiste(formattedMemberData.UserInfo.employeeNo, service);
                        await this.sleep(delay_between_request);

                        let addOrEditResult = null;
                        let faceUploadSuccess = false;

                        if (exists === true) {
                            addOrEditResult = await service.rawPut(API_PATHS.USER_UPDATE, formattedMemberData);
                            await this.sleep(delay_between_request);
                            await this.deleteFace(formattedMemberData.UserInfo.employeeNo, service);
                        } else {
                            addOrEditResult = await service.rawPost(API_PATHS.USER_RECORD, formattedMemberData);
                            await this.sleep(delay_between_request);
                        }

                        // Only proceed with card and face operations if user was created/updated successfully
                        if (addOrEditResult?.success) {
                            // Handle cards
                            if (member?.listCards && member.listCards.length > 0) {
                                await this.deleteCardNo(formattedMemberData.UserInfo.employeeNo, service);
                                const listCards = member?.listCards ?? [];

                                for (const card of listCards) {
                                    if (!card.cardNo) continue;
                                    await this.sleep(delay_between_request);
                                    await service.rawPost(API_PATHS.CARD_RECORD, {
                                        CardInfo: {
                                            employeeNo: formattedMemberData.UserInfo.employeeNo,
                                            cardNo: card.cardNo,
                                            cardType: card.cardType,
                                            isValid: true
                                        }
                                    });
                                }
                            }

                            // Handle face upload with retries
                            if (formattedMemberData.UserInfo?.faceList?.enable) {
                                // Wait longer before face upload - device needs time to process previous operations
                                await this.sleep(1500);
                                faceUploadSuccess = await this.uploadFaceWithRetry(
                                    formattedMemberData,
                                    service,
                                    2 // max retries
                                );
                            }
                        }

                        return {
                            ...addOrEditResult,
                            faceUploadSuccess
                        };
                    } catch (error) {
                        log.error(`Error processing device ${device.address_ip}: ${error.message}`, error);
                        throw error;
                    }
                }
            );

            res.json({
                operation: 'add_or_edit_member',
                member_id: member.member_id,
                member_subscription_id: member?.member_subscription_id ?? null,
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

    // Delete member from multiple devices
    async deleteMember(req, res) {
        const delay_between_request = 350;
        try {
            const { devices, employeeNo, member_id } = req.body;

            if (!devices || !Array.isArray(devices) || devices.length === 0) {
                return res.status(400).json({
                    error: 'Devices array is required and cannot be empty'
                });
            }

            if (!employeeNo) {
                return res.status(400).json({
                    error: 'employeeNo is required'
                });
            }
            const result = await this.processMultipleDevices(
                devices,
                async (service) => {

                    const exists = await this.checkMemberIfExiste(employeeNo, service)
                    let userDeleteResult = null
                    if (exists === true) {
                        await this.sleep(delay_between_request);
                        userDeleteResult = await this.deleteEmployeNo(employeeNo, service)

                        // const deleteData = {
                        //     UserInfoDelCond: {
                        //         EmployeeNoList: [{ employeeNo: employeeNo }]
                        //     }
                        // };
                        // await this.sleep(delay_between_request);
                        // userDeleteResult = await service.rawPut(API_PATHS.USER_DELETE, deleteData);
                        // await this.sleep(delay_between_request);
                        // await this.deleteFace(employeeNo, service)
                        // await this.sleep(delay_between_request);
                        // await this.deleteCardNo(employeeNo, service)
                    }
                    return userDeleteResult;
                }
            );

            res.json({
                operation: 'delete_member',
                member_id: member_id,
                matricule: employeeNo,
                summary: result
            });
        } catch (error) {
            log.error(error.message, error, {})
            res.status(500).json({
                error: 'Internal server error',
                details: error.message
            });
        }
    }
    async checkMemberIfExiste(employeeNo, service) {


        try {
            const searchData = {
                UserInfoSearchCond: {
                    searchID: "1",
                    searchResultPosition: 0,
                    maxResults: 1,
                    EmployeeNoList: [{ employeeNo: employeeNo }]
                }
            };
            const searchResult = await service.rawPost(API_PATHS.USER_SEARCH, searchData);

            // Check if member exists in the response
            const exists = !!(
                searchResult?.success &&
                searchResult?.data?.UserInfoSearch?.totalMatches > 0
            );

            return exists;
        } catch (error) {
            if (error.stack) console.error("[DEBUG] Stack:", error.stack);
            return false;
        }
    }
    deleteMembersBySubscriptionStatus = async (req, res) => {
        console.log("================== START DELETE USERS ====================")
        const authHeader = req.headers.authorization;
        const clubUUID = req.body.clubUUID ?? '';
        const endPoint = req?.body?.endPoint ?? null; //?? '/api/pointeuse/deleted-members/'; // endPoint laravel backend

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        let responsePayload = {}
        try {
            const { delay_between_request = 500, delay_between_devices = 300 } = req.query;

            if (!req.file) {
                return res.status(400).json({ error: 'File is required (field name: members_file)' });
            }

            // Read uploaded file
            const fileData = fs.readFileSync(req.file.path, 'utf-8');
            let membersData;
            try {
                membersData = JSON.parse(fileData);
            } catch (error) {
                log.error(error.message, error, {})
                return res.status(400).json({ error: 'Invalid JSON file' });
            } finally {
                // Delete file after reading
                fs.unlinkSync(req.file.path);
            }

            if (!Array.isArray(membersData) || membersData.length === 0) {
                return res.status(400).json({ error: 'JSON file must contain a non-empty array of members with their devices' });
            }

            const syncResults = [];
            let processedCount = 0;


            for (const item of membersData) {
                processedCount++;
                const { devices, member } = item;

                // Validate member
                if (!devices || !Array.isArray(devices) || devices.length === 0) {
                    syncResults.push({ member: member?.employeeNo || `unknown_${processedCount}`, name: member?.name || 'Unknown', success: false, device_details: [] });
                    continue;
                }

                const formattedMemberData = this.formatMemberData(member);
                const deviceResults = [];
                const result = await this.processMultipleDevices(
                    devices,
                    async (service, device) => {
                        try {
                            // Check if member exists
                            const exists = await this.checkMemberIfExiste(formattedMemberData.UserInfo.employeeNo, service);
                            let result = null;

                            if (exists === true) {
                                await this.sleep(delay_between_request);
                                result = await this.deleteEmployeNo(formattedMemberData.UserInfo.employeeNo, service)
                            } 
                            deviceResults.push({
                                pointeuse_id: device.pointeuse_id,
                                ip: device.address_ip, 
                                success: result?.success === true
                            });
                        } catch (error) {
                            deviceResults.push({
                                pointeuse_id: device.pointeuse_id,
                                ip: device.address_ip,
                                success: false
                            });
                            log.error(`Error processing device ${device.address_ip}: ${error.message}`, error);
                            throw error;
                        }
                    }
                );

                const failedDevices = deviceResults.filter(r => !r.success);

                syncResults.push({
                    member_id: member.member_id,
                    member_subscription_id: member?.member_subscription_id ?? null,
                    success: failedDevices.length === 0,
                    device_details: deviceResults

                });

                if (processedCount < membersData.length) {
                    await this.sleep(delay_between_devices);
                }
            }

            // Summary
            const totalMembers = syncResults.length;
            const successfulMembers = syncResults.filter(r => r.success).length;
            const failedMembers = syncResults.filter(r => !r.success).length;

            responsePayload = {
                operation: 'sync_members_from_file',
                summary: {
                    total_members: totalMembers,
                    successful_members: successfulMembers,
                    failed_members: failedMembers
                },
                results: syncResults
            }
            res.json(responsePayload);

        } catch (error) {
            console.log("error : ", error.message)
            log.error(error.message, error, {})
            res.status(500).json({
                error: 'Internal server error during sync',
                details: error.message
            });
        } finally {

            if (!responsePayload || endPoint === null) return;

            const tmpDir = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { recursive: true });
            }

            const fileName = `delete_members_${Date.now()}.json`;
            const filePath = path.join(tmpDir, fileName);

            try {
                // 1️⃣ Save result to file
                fs.writeFileSync(
                    filePath,
                    JSON.stringify(responsePayload, null, 2),
                    'utf-8'
                );

                // 2️⃣ Send file to Laravel API
                const formData = new FormData();
                formData.append(
                    'file',
                    fs.createReadStream(filePath),
                    fileName
                );
                await axios.post(
                    `${BACKEND_API.ENDPOINT}${endPoint}${clubUUID}`,
                    formData,
                    {
                        headers: {
                            ...formData.getHeaders(),
                            Authorization: authHeader
                        },
                        timeout: process.env.NETWORK_TIMEOUT || 30000
                    }
                );
            } catch (error) {
                console.error('❌ Failed to send sync result file deleted:', error.message);
            } finally {
                //  3️⃣ Remove local file
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            console.log("================== Finished DELETE USERS ====================")
        }
    };





    // Example route: POST /sync-members-file
    // router.post('/sync-members-file', upload.single('members_file'), syncMembers);

    syncMembersViaFileJson = async (req, res) => {
        console.log("================== START SYNC TO POINTEUSE ====================");
        const authHeader = req.headers.authorization;
        const clubUUID = req.body.clubUUID ?? '';
        const endPoint = req?.body?.endPoint ?? null; //?? '/api/pointeuse/sync-result/'; // endPoint laravel backend

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        let responsePayload = {};
        try {
            const { delay_between_request = 500, delay_between_devices = 300 } = req.query;

            if (!req.file) {
                return res.status(400).json({ error: 'File is required (field name: members_file)' });
            }

            // Read uploaded file 
            const fileData = fs.readFileSync(req.file.path, 'utf-8');
            let membersData;
            try {
                membersData = JSON.parse(fileData);
            } catch (error) {
                log.error(error.message, error, {});
                return res.status(400).json({ error: 'Invalid JSON file' });
            } finally {
                // Delete file after reading
                fs.unlinkSync(req.file.path);
            }

            if (!Array.isArray(membersData) || membersData.length === 0) {
                return res.status(400).json({ error: 'JSON file must contain a non-empty array of members with their devices' });
            }

            const syncResults = [];
            let processedCount = 0;


            for (const item of membersData) {
                processedCount++;

                const { devices, member } = item;

                const deviceResults = [];

                // Validate member
                if (!devices || !Array.isArray(devices) || devices.length === 0) {
                    syncResults.push({ member: member?.employeeNo || `unknown_${processedCount}`, name: member?.name || 'Unknown', success: false, device_details: [] });
                    continue;
                }

                const formattedMemberData = this.formatMemberData(member);


                const result = await this.processMultipleDevices(
                    devices,
                    async (service, device) => {
                        try {
                            // Check if member exists
                            const exists = await this.checkMemberIfExiste(formattedMemberData.UserInfo.employeeNo, service);
                            await this.sleep(delay_between_request);


                            let addOrEditResult = null;
                            let faceUploadSuccess = false;

                            if (exists === true) {
                                addOrEditResult = await service.rawPut(API_PATHS.USER_UPDATE, formattedMemberData);
                                await this.sleep(delay_between_request);
                                await this.deleteFace(formattedMemberData.UserInfo.employeeNo, service);
                            } else {
                                addOrEditResult = await service.rawPost(API_PATHS.USER_RECORD, formattedMemberData);
                                await this.sleep(delay_between_request);
                            }


                            // Only proceed with card and face operations if user was created/updated successfully
                            if (addOrEditResult?.success) {
                                // Handle cards
                                if (member?.listCards && member.listCards.length > 0) {
                                    await this.deleteCardNo(formattedMemberData.UserInfo.employeeNo, service);
                                    const listCards = member?.listCards ?? [];

                                    for (const card of listCards) {
                                        if (!card.cardNo) continue;
                                        await this.sleep(delay_between_request);
                                        await service.rawPost(API_PATHS.CARD_RECORD, {
                                            CardInfo: {
                                                employeeNo: formattedMemberData.UserInfo.employeeNo,
                                                cardNo: card.cardNo,
                                                cardType: card.cardType,
                                                isValid: true
                                            }
                                        });
                                    }
                                }

                                // Handle face upload with retries
                                if (formattedMemberData.UserInfo.faceList?.enable) {
                                    // Wait longer before face upload - device needs time to process previous operations
                                    await this.sleep(1500);
                                    faceUploadSuccess = await this.uploadFaceWithRetry(
                                        formattedMemberData,
                                        service,
                                        2 // max retries
                                    );
                                }
                            }
                            deviceResults.push({
                                pointeuse_id: device.pointeuse_id,
                                ip: device.address_ip,
                                 success: addOrEditResult?.success === true,
                                faceUploadSuccess: faceUploadSuccess,
                            });
                        } catch (error) {
                            deviceResults.push({
                                pointeuse_id: device.pointeuse_id,
                                ip: device.address_ip,
                                success: false,
                                faceUploadSuccess: false,
                            });
                            log.error(`Error processing device ${device.address_ip}: ${error.message}`, error);
                            throw error;
                        }
                    }
                );


                const failedDevices = deviceResults.filter(r => !r.success);

                syncResults.push({
                    member_subscription_id: member?.member_subscription_id ?? null,
                    member_id: member.member_id,
                    success: failedDevices.length === 0,
                    device_details: deviceResults
                });

                if (processedCount < membersData.length) {
                    await this.sleep(delay_between_devices);
                }
            }

            // Summary
            const totalMembers = syncResults.length;
            const successfulMembers = syncResults.filter(r => r.success).length;
            const failedMembers = syncResults.filter(r => !r.success).length;


            responsePayload = {
                operation: 'sync_members_from_file',
                summary: {
                    total_members: totalMembers,
                    successful_members: successfulMembers,
                    failed_members: failedMembers
                },
                results: syncResults
            };
            res.json(responsePayload);

        } catch (error) {
            console.error("[DEBUG] Top-level catch error:", error.message);
            log.error(error.message, error, {});
            res.status(500).json({
                error: 'Internal server error during sync',
                details: error.message
            });
        } finally {

            if (!responsePayload || endPoint === null) {
                return;
            }

            const tmpDir = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { recursive: true });
            }

            const fileName = `sync_result_${Date.now()}.json`;
            const filePath = path.join(tmpDir, fileName);
            const targetUrl = `${BACKEND_API.ENDPOINT}${endPoint}${clubUUID}`;
            try {
                // 1️⃣ Save result to file
                fs.writeFileSync(
                    filePath,
                    JSON.stringify(responsePayload, null, 2),
                    'utf-8'
                );

                // 2️⃣ Send file to Laravel API
                const formData = new FormData();
                formData.append(
                    'file',
                    fs.createReadStream(filePath),
                    fileName
                );


                await axios.post(
                    targetUrl,
                    formData,
                    {
                        headers: {
                            ...formData.getHeaders(),
                            Authorization: authHeader
                        },
                        timeout: process.env.NETWORK_TIMEOUT || 30000
                    }
                );
            } catch (error) {
                console.error('[DEBUG] Failed to send sync result file:', error.message); 
            } finally {
                // 3️⃣ Remove local file
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            console.log("================== Finished syncMembers from file ====================");
        }
    };


    // check capabilities devices
    async checkCapabilities(req, res) {

        try {
            const { devices, api_path } = req.body;

            if (!devices || !Array.isArray(devices) || devices.length === 0) {
                return res.status(400).json({
                    error: 'Devices array is required and cannot be empty'
                });
            }

            if (!api_path) {
                return res.status(400).json({
                    error: 'api_path is required'
                });
            }

            const result = await this.processMultipleDevices(
                devices,
                async (service) => {
                    const resultAPI = await service.get(api_path);
                    return resultAPI;
                }
            );

            res.json({
                operation: 'check_capabilities',
                api_path: api_path,
                results: result
            });
        } catch (error) {
            log.error(error.message, error, {})
            res.status(500).json({
                error: 'Internal server error',
                details: error.message
            });
        }
    }





    // Upload face with retry mechanism
    async uploadFaceWithRetry(memberData, service, maxRetries = 2) {
        const faceURL = memberData?.UserInfo?.faceList?.img;
        if (!faceURL) {
            return false;
        }

        // Get extension
        const extension = faceURL.split('.').pop().toLowerCase();
        const allowedExtensions = ['png', 'jpg', 'jpeg'];

        if (!allowedExtensions.includes(extension)) {
            return false;
        }

        const payload = {
            faceLibType: "blackFD",
            FDID: "1",
            FPID: memberData?.UserInfo?.employeeNo ?? "0",
            name: memberData?.UserInfo?.name ?? "0",
            gender: "male",
            faceURL: memberData?.UserInfo?.faceList?.img
        };

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {

                // Add longer timeout for face upload
                const resultFaceRecord = await service.rawPost(API_PATHS.FACE_DATA_RECORD, payload, {
                    timeout: process.env.NETWORK_TIMEOUT || 30000
                });


                if (resultFaceRecord?.success) {
                    return true;
                }

                // If not successful but no error, wait and retry
                await this.sleep(1500 * attempt); // Exponential backoff
            } catch (error) {

                if (attempt === maxRetries) {
                    return false;
                }

                // Wait before retry with exponential backoff
                await this.sleep(1500 * attempt);
            }
        }

        return false;
    }





    async deleteFace(employeeNo, service) {
        try {
            const deleteFaceRecord = {
                "FPID": [
                    {
                        "value": employeeNo,
                        "rowKey": 1
                    }
                ],
                "operateType": "byTerminal",
                "terminalNoList": [1]
            }
            const resultDeleteFaceRecord = await service.rawPut(
                `${API_PATHS.FACE_DATA_DELETE}&FDID=1&faceLibType=blackFD`, deleteFaceRecord
            );
            return resultDeleteFaceRecord;
        } catch (error) {
            // Don't throw, just log - face might not exist
            return null;
        }

    }

    async deleteCardNo(employees, service) {
        let employeeList = [];

        // Case 1: array of objects [{ employeNo: 'zz' }]
        if (Array.isArray(employees)) {
            employeeList = employees.map(e => ({
                employeeNo: e.employeNo
            }));
        }
        // Case 2: single object { employeNo: 'zz' }
        else if (employees?.employeNo) {
            employeeList = [
                { employeeNo: employees.employeNo }
            ];
        }
        // Case 3: single string 'zz'
        else {
            employeeList = [
                { employeeNo: employees }
            ];
        }

        const payload = {
            CardInfoDelCond: {
                EmployeeNoList: employeeList
            }
        };

        await service.rawPut(API_PATHS.USER_DELETE, payload);
    }

    async deleteEmployeNo(employees, service) {
        let employeeList = [];
        try {
            // Case 1: array of objects [{ employeNo: 'zz' }]
            if (Array.isArray(employees)) {
                employeeList = employees.map(e => ({
                    employeeNo: e.employeNo
                }));
            }
            // Case 2: single object { employeNo: 'zz' }
            else if (employees?.employeNo) {
                employeeList = [
                    { employeeNo: employees.employeNo }
                ];
            }
            // Case 3: single string 'zz'
            else {
                employeeList = [
                    { employeeNo: employees }
                ];
            }

            const payload = {
                UserInfoDelCond: {
                    EmployeeNoList: employeeList
                }
            };
            const resultDeleteEmployee = await service.rawPut(API_PATHS.USER_DELETE, payload);
             
            return resultDeleteEmployee;
        } catch (error) {
            // Don't throw, just log - face might not exist
            return false;
        }
    }

    // Helper method for sleeping
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

}


module.exports = new MemberController();
