UPDATE "TwoFactorChallenge" SET "method" = 'AUTHENTICATOR' WHERE "method" = 'TOTP';
UPDATE "User" SET "twoFactorMethod" = 'AUTHENTICATOR' WHERE "twoFactorMethod" = 'TOTP';