import { useState } from 'react';
import { Upload, Mail, Download, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import toast, { Toaster } from 'react-hot-toast';
import Papa from 'papaparse';

interface ValidationResult {
  email: string;
  validation_result: string;
  validation_reason: string;
  [key: string]: string;
}

function App() {
  const [email, setEmail] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [csvResults, setCsvResults] = useState<ValidationResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [isBulkValidating, setIsBulkValidating] = useState(false);

  const validateEmail = async (emailToValidate: string) => {
    try {
      setIsValidating(true);
      const response = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToValidate }),
      });
      const data = await response.json();
      setValidationResult(data);
      toast.success('Validation complete!');
    } catch (error) {
      toast.error('Validation failed. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setIsBulkValidating(true);
      setCsvResults([]);
      setProgress(0);

      Papa.parse(file, {
        complete: async (results) => {
          const headers = results.data[0] as string[];
          const emailColumnIndex = headers.findIndex(
            header => header.toLowerCase().includes('email')
          );

          if (emailColumnIndex === -1) {
            toast.error('No email column found in CSV');
            setIsBulkValidating(false);
            return;
          }

          const totalRows = results.data.length - 1;
          const batchSize = 50;
          let validatedResults: ValidationResult[] = [];

          for (let i = 1; i < results.data.length; i += batchSize) {
            const batch = results.data.slice(i, i + batchSize).map((row: any) => ({
              ...row,
              email: row[emailColumnIndex],
            }));

            try {
              const response = await fetch('/api/validate-bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emails: batch }),
              });

              const validatedBatch = await response.json();
              validatedResults = [...validatedResults, ...validatedBatch];
              setProgress(Math.min(((i + batchSize) / totalRows) * 100, 100));
              setCsvResults(validatedResults);
            } catch (error) {
              toast.error('Validation failed for some emails');
            }
          }

          setIsBulkValidating(false);
          toast.success('Bulk validation complete!');
        },
        header: true,
        skipEmptyLines: true,
      });
    },
  });

  const downloadResults = () => {
    if (csvResults.length === 0) return;

    const csv = Papa.unparse(csvResults);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'email_validation_results.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Email Validator Tool</h1>
          <p className="text-lg text-gray-600">Verify email addresses and mailbox existence</p>
        </div>

        <div className="space-y-8">
          {/* Single Email Validation */}
          <div className="validation-card p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Single Email Validation</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="input-label">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full"
                />
              </div>
              <button
                onClick={() => validateEmail(email)}
                disabled={!email || isValidating}
                className="primary-button"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 inline" />
                    Validating...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 inline mr-2" />
                    Validate Email
                  </>
                )}
              </button>

              {validationResult && (
                <div className="mt-4 p-4 rounded-lg bg-gray-50">
                  <h3 className="font-medium text-gray-900 mb-2">Validation Result:</h3>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Status:</span>{' '}
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          validationResult.validation_result === 'Valid'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {validationResult.validation_result}
                      </span>
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Reason:</span>{' '}
                      <span className="text-gray-600">{validationResult.validation_reason}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bulk CSV Validation */}
          <div className="validation-card p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Bulk CSV Validation</h2>
            <div {...getRootProps()} className="dropzone">
              <input {...getInputProps()} />
              <div className="text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                  Drag & drop a CSV file here, or click to select
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  CSV must contain a column named "email" or "emails"
                </p>
              </div>
            </div>

            {isBulkValidating && (
              <div className="mt-4">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">Processing...</span>
                  <span className="text-sm font-medium text-gray-700">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {csvResults.length > 0 && (
              <>
                <button onClick={downloadResults} className="secondary-button mt-4">
                  <Download className="w-4 h-4 inline mr-2" />
                  Download Results
                </button>

                <div className="mt-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Results Preview</h3>
                  <div className="max-h-96 overflow-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {Object.keys(csvResults[0]).map((header) => (
                            <th
                              key={header}
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {csvResults.map((result, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            {Object.entries(result).map(([key, value]) => (
                              <td key={key} className="px-6 py-4 whitespace-nowrap text-sm">
                                {key === 'validation_result' ? (
                                  <span
                                    className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                      value === 'Valid'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}
                                  >
                                    {value}
                                  </span>
                                ) : (
                                  <span
                                    className={
                                      key === 'validation_reason' ? 'text-gray-500' : 'text-gray-900'
                                    }
                                  >
                                    {value?.toString()}
                                  </span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;