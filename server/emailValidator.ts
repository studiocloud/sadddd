import dns from 'dns';
import { promisify } from 'util';
import net from 'net';

const resolveMx = promisify(dns.resolveMx);

interface ValidationResult {
  email: string;
  validation_result: string;
  validation_reason: string;
  [key: string]: string;
}

async function validateDomain(domain: string): Promise<boolean> {
  try {
    const records = await resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}

async function validateMailbox(email: string, domain: string): Promise<{ isValid: boolean; reason: string }> {
  try {
    const mxRecords = await resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return { isValid: false, reason: 'No MX records found for domain' };
    }

    const mxHost = mxRecords[0].exchange;
    const socket = new net.Socket();
    
    return new Promise((resolve) => {
      let responseBuffer = '';
      let hasError = false;

      const cleanupAndResolve = (isValid: boolean, reason: string) => {
        if (!hasError) {
          socket.destroy();
          resolve({ isValid, reason });
        }
      };

      socket.setTimeout(10000); // 10 second timeout

      socket.on('connect', () => {
        socket.write(`HELO ${domain}\r\n`);
      });

      socket.on('data', (data) => {
        responseBuffer += data.toString();
        if (responseBuffer.includes('220') && !responseBuffer.includes('HELO')) {
          socket.write(`MAIL FROM:<check@${domain}>\r\n`);
        } else if (responseBuffer.includes('250') && responseBuffer.includes('MAIL FROM')) {
          socket.write(`RCPT TO:<${email}>\r\n`);
        } else if (responseBuffer.includes('RCPT TO')) {
          if (responseBuffer.includes('250')) {
            cleanupAndResolve(true, 'Mailbox exists');
          } else if (responseBuffer.includes('550') || responseBuffer.includes('553')) {
            cleanupAndResolve(false, 'Mailbox does not exist');
          } else {
            cleanupAndResolve(false, 'Unable to verify mailbox');
          }
        }
      });

      socket.on('error', () => {
        hasError = true;
        resolve({ isValid: false, reason: 'Connection failed' });
      });

      socket.on('timeout', () => {
        hasError = true;
        resolve({ isValid: false, reason: 'Connection timeout' });
      });

      socket.connect(25, mxHost);
    });
  } catch (error) {
    return { isValid: false, reason: 'Failed to verify mailbox' };
  }
}

export async function validateEmail(email: string): Promise<ValidationResult> {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!emailRegex.test(email)) {
    return {
      email,
      validation_result: 'Invalid',
      validation_reason: 'Invalid email format',
    };
  }

  const [, domain] = email.split('@');

  const hasMx = await validateDomain(domain);
  if (!hasMx) {
    return {
      email,
      validation_result: 'Invalid',
      validation_reason: 'Domain does not have valid MX records',
    };
  }

  const { isValid, reason } = await validateMailbox(email, domain);
  
  return {
    email,
    validation_result: isValid ? 'Valid' : 'Invalid',
    validation_reason: reason,
  };
}

export async function validateEmailBulk(emails: any[]): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (const row of emails) {
    try {
      const result = await validateEmail(row.email);
      results.push({
        ...row,
        validation_result: result.validation_result,
        validation_reason: result.validation_reason,
      });
    } catch (error) {
      results.push({
        ...row,
        validation_result: 'Error',
        validation_reason: 'Validation failed',
      });
    }
    await delay(100); // Reduced delay to 100ms for faster bulk processing
  }

  return results;
}