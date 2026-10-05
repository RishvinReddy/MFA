import { Request, Response } from 'express';
import { verifyPreRegOtp } from '../../src/controllers/mfa.controller';
import { cacheService } from '../../src/services/cache.service';

jest.mock('../../src/services/cache.service');

describe('MFA Controller - Cache Isolation', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let statusMock: jest.Mock;
    let jsonMock: jest.Mock;

    beforeEach(() => {
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        mockReq = {
            body: { email: 'test@example.com', code: '123456' }
        };
        mockRes = {
            status: statusMock as any,
            json: jsonMock as any
        };
        jest.clearAllMocks();
    });

    it('should return 400 when CacheService verifyOtp returns TOO_MANY_ATTEMPTS', async () => {
        (cacheService.verifyOtp as jest.Mock).mockResolvedValue('TOO_MANY_ATTEMPTS');

        await verifyPreRegOtp(mockReq as Request, mockRes as Response);

        expect(cacheService.verifyOtp).toHaveBeenCalledWith('bioshield:otp:prereg:test@example.com', '123456', 3);
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({ success: false, message: "Too many failed attempts. Request a new code." });
    });

    it('should return 400 when CacheService verifyOtp returns INVALID_CODE', async () => {
        (cacheService.verifyOtp as jest.Mock).mockResolvedValue('INVALID_CODE');

        await verifyPreRegOtp(mockReq as Request, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({ success: false, message: "Invalid verification code" });
    });

    it('should return 500 when CacheService verifyOtp returns ERROR safely falling back', async () => {
        (cacheService.verifyOtp as jest.Mock).mockResolvedValue('ERROR');

        await verifyPreRegOtp(mockReq as Request, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({ success: false, message: "Verification unavailable" });
    });

    it('should return success when CacheService verifyOtp returns SUCCESS', async () => {
        (cacheService.verifyOtp as jest.Mock).mockResolvedValue('SUCCESS');

        await verifyPreRegOtp(mockReq as Request, mockRes as Response);

        expect(jsonMock).toHaveBeenCalledWith({ success: true, message: "Email verified successfully" });
    });
});
