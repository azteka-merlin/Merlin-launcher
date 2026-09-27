function createLicenseTokenClient({ axios, authSession, url, launcherVersion, timeout = 20000 }) {
    async function request(accessToken, appId, licenseBytes) {
        return axios.post(url, licenseBytes, {
            timeout,
            maxBodyLength: Infinity,
            params: { appid: appId },
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'X-Merlin-Version': launcherVersion,
                Accept: 'application/json',
                'Content-Type': 'application/octet-stream'
            }
        });
    }

    async function generate({ appId, licenseBytes }) {
        try {
            let accessToken = await authSession.getAccessToken();
            let response;
            try {
                response = await request(accessToken, appId, licenseBytes);
            } catch (error) {
                if (error?.response?.status !== 401) throw error;
                await authSession.handleUnauthorized();
                accessToken = await authSession.getAccessToken();
                response = await request(accessToken, appId, licenseBytes);
            }

            const token = typeof response?.data?.token === 'string' ? response.data.token : '';
            if (!response?.data?.success || !token) {
                const error = new Error('Invalid token response');
                error.code = 'token_request_failed';
                throw error;
            }
            return token;
        } catch (error) {
            if (error?.code === 'missing') error.code = 'auth_required';
            else if (typeof error?.response?.data?.code === 'string') error.code = error.response.data.code;
            else if (!error?.code || error.code.startsWith('ERR_')) error.code = 'token_request_failed';
            throw error;
        }
    }

    return { generate };
}

module.exports = { createLicenseTokenClient };
