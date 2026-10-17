import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Upload, CheckCircle2, AlertCircle, Loader2, Video, X, Mail, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function KYCVerification() {
  const [user, setUser] = useState(null);
  const [selfieVideo, setSelfieVideo] = useState(null);
  const [idDocument, setIdDocument] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [idPreview, setIdPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [sendingEmailCode, setSendingEmailCode] = useState(false);
  const [verifyingEmailCode, setVerifyingEmailCode] = useState(false);
  const [sendingPhoneCode, setSendingPhoneCode] = useState(false);
  const [verifyingPhoneCode, setVerifyingPhoneCode] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordingStep, setRecordingStep] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraMode, setCameraMode] = useState(null); // 'selfie' or 'id'
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const idInputRef = useRef(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);

        if (currentUser.kyc_status === 'approved') {
          navigate(createPageUrl('Home'));
          return;
        }
        setPhoneInput(currentUser.phone_number || currentUser.pending_phone_number || '');
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    loadUser();
  }, [navigate]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setCameraMode(null);
  };

  const startCamera = async (mode) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: mode === 'selfie' ? 'user' : 'environment' },
        audio: false 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setCameraMode(mode);
      setError('');
    } catch (err) {
      setError('Camera access denied. Please allow camera permissions or upload files instead.');
    }
  };

  const startRecording = async () => {
    if (!streamRef.current || !videoRef.current) return;
    
    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
    mediaRecorderRef.current = mediaRecorder;
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const file = new File([blob], 'selfie-verification.webm', { type: 'video/webm' });
      setSelfieVideo(file);
      setSelfiePreview(URL.createObjectURL(blob));
      stopCamera();
      setRecording(false);
      setRecordingStep(0);
    };
    
    mediaRecorder.start();
    setRecording(true);
    setRecordingStep(0);
    
    // Simulate step advances (5 steps, 2 sec each = 10 sec total)
    const stepInterval = setInterval(() => {
      setRecordingStep(prev => {
        if (prev >= 4) {
          clearInterval(stepInterval);
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
          return prev;
        }
        return prev + 1;
      });
    }, 2000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    
    canvas.toBlob((blob) => {
      const file = new File([blob], 'id-document.jpg', { type: 'image/jpeg' });
      setIdDocument(file);
      setIdPreview(URL.createObjectURL(blob));
      stopCamera();
    }, 'image/jpeg', 0.95);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setIdDocument(file);
      setIdPreview(reader.result);
    };
    reader.readAsDataURL(file);
    setError('');
  };

  const sendEmailCode = async () => {
    setSendingEmailCode(true);
    setError('');
    try {
      await base44.functions.invoke('sendEmailVerificationCode', {});
    } catch (error) {
      setError(error?.response?.data?.error || error.message || 'Failed to send email code.');
    } finally {
      setSendingEmailCode(false);
    }
  };

  const verifyEmailCode = async () => {
    if (!emailCode) {
      setError('Enter the email code first.');
      return;
    }
    setVerifyingEmailCode(true);
    setError('');
    try {
      await base44.functions.invoke('verifyEmailCode', { code: emailCode });
      const refreshedUser = await base44.auth.me();
      setUser(refreshedUser);
      setEmailCode('');
    } catch (error) {
      setError(error?.response?.data?.error || error.message || 'Failed to verify email code.');
    } finally {
      setVerifyingEmailCode(false);
    }
  };

  const sendPhoneCode = async () => {
    if (!phoneInput) {
      setError('Enter your phone number first.');
      return;
    }
    setSendingPhoneCode(true);
    setError('');
    try {
      await base44.functions.invoke('sendPhoneVerification', { phone: phoneInput });
      const refreshedUser = await base44.auth.me();
      setUser(refreshedUser);
    } catch (error) {
      setError(error.message || 'Failed to send phone code.');
    } finally {
      setSendingPhoneCode(false);
    }
  };

  const verifyPhoneCode = async () => {
    if (!phoneCode) {
      setError('Enter the phone code first.');
      return;
    }
    setVerifyingPhoneCode(true);
    setError('');
    try {
      await base44.functions.invoke('verifyPhoneCode', { code: phoneCode });
      const refreshedUser = await base44.auth.me();
      setUser(refreshedUser);
      setPhoneCode('');
    } catch (error) {
      setError(error.message || 'Failed to verify phone code.');
    } finally {
      setVerifyingPhoneCode(false);
    }
  };

  const handleSubmit = async () => {
    if (!user?.email_verified_for_kyc) {
      setError('Please confirm your email before submitting KYC.');
      return;
    }

    if (!user?.phone_verified) {
      setError('Please verify your phone number before submitting KYC.');
      return;
    }

    if (!selfieVideo || !idDocument) {
      setError('Please record your liveness video and capture your ID document');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // Upload selfie video
      const selfieResult = await base44.integrations.Core.UploadFile({ file: selfieVideo });

      // Upload ID document
      const idResult = await base44.integrations.Core.UploadFile({ file: idDocument });

      // Update user with KYC information
      await base44.auth.updateMe({
        kyc_status: 'submitted',
        kyc_selfie_url: selfieResult.file_url,
        kyc_id_url: idResult.file_url,
        kyc_submitted_at: new Date().toISOString(),
      });

      // Notify admin via email
      await base44.functions.invoke('notifyKYCSubmission', {
        data: {
          full_name: user.full_name,
          email: user.email,
          kyc_status: 'submitted',
          kyc_submitted_at: new Date().toISOString(),
        },
        event: { type: 'update' },
      }).catch(() => {}); // non-blocking

      // Redirect to home
      navigate(createPageUrl('Home'));
    } catch (error) {
      console.error('KYC submission error:', error);
      setError('Failed to submit verification. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0A0612] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  if (user.kyc_status === 'submitted') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0A0612] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 text-yellow-500" />
            </div>
            <CardTitle>Verification Pending</CardTitle>
            <CardDescription>
              Your identity verification is under review. This usually takes 24-48 hours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate(createPageUrl('Home'))}
              className="w-full"
              variant="outline"
            >
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user.kyc_status === 'rejected') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0A0612] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <CardTitle>Verification Rejected</CardTitle>
            <CardDescription>
              {user.kyc_notes || 'Your verification was not approved. Please submit again with clear photos.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={async () => {
                await base44.auth.updateMe({ kyc_status: 'pending' });
                const refreshedUser = await base44.auth.me();
                setUser(refreshedUser);
              }}
              className="w-full bg-gradient-to-r from-pink-500 to-pink-600"
            >
              Submit Again
            </Button>
            <Button
              onClick={() => navigate(createPageUrl('Support'))}
              variant="outline"
              className="w-full"
            >
              Contact Support
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0612] p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-pink-500/10 rounded-full flex items-center justify-center mb-4">
              <Camera className="w-8 h-8 text-pink-500" />
            </div>
            <CardTitle className="text-2xl">Identity Verification</CardTitle>
            <CardDescription>
              To comply with regulations, we need to verify your identity. Please upload a selfie and a photo of your government-issued ID.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Camera Modal */}
            {cameraActive && (
              <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-[#1A1528] rounded-2xl max-w-2xl w-full p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {cameraMode === 'selfie' ? 'Record Liveness Video' : 'Capture ID Photo'}
                    </h3>
                    <Button variant="ghost" size="icon" onClick={stopCamera}>
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                  
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full rounded-lg bg-black mb-4"
                  />
                  
                  {cameraMode === 'selfie' && recording && (
                    <div className="mb-4 text-center">
                      <div className="text-pink-500 font-bold text-lg mb-2">
                        {['Look straight ahead', 'Turn head LEFT', 'Turn head RIGHT', 'Look UP', 'Look DOWN'][recordingStep] || 'Recording...'}
                      </div>
                      <div className="flex justify-center gap-2">
                        {[0, 1, 2, 3, 4].map((step) => (
                          <div
                            key={step}
                            className={`w-3 h-3 rounded-full ${
                              step <= recordingStep ? 'bg-pink-500' : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    {cameraMode === 'selfie' && !recording && (
                      <Button
                        onClick={startRecording}
                        className="flex-1 bg-gradient-to-r from-pink-500 to-pink-600"
                      >
                        <Video className="w-4 h-4 mr-2" />
                        Start Recording
                      </Button>
                    )}
                    {cameraMode === 'selfie' && recording && (
                      <Button
                        onClick={stopRecording}
                        className="flex-1 bg-red-500 hover:bg-red-600"
                      >
                        Stop Recording
                      </Button>
                    )}
                    {cameraMode === 'id' && (
                      <Button
                        onClick={capturePhoto}
                        className="flex-1 bg-gradient-to-r from-pink-500 to-pink-600"
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Capture Photo
                      </Button>
                    )}
                  </div>
                  
                  {cameraMode === 'selfie' && !recording && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
                      Follow the prompts to turn your head in different directions. This ensures you're a real person.
                    </p>
                  )}
                </div>
              </div>
            )}
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium">
                  <Mail className="w-4 h-4 text-pink-500" />
                  Email Confirmation
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Confirm {user.email} with a one-time code.
                </p>
                <div className="flex gap-2">
                  <Button onClick={sendEmailCode} disabled={sendingEmailCode || user.email_verified_for_kyc} className="flex-1 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700">
                    {sendingEmailCode ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Code'}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <input
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value)}
                    placeholder="Enter email code"
                    className="flex-1 h-10 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-[#120d1d] px-3 text-sm text-gray-900 dark:text-white"
                  />
                  <Button onClick={verifyEmailCode} disabled={verifyingEmailCode || user.email_verified_for_kyc} variant="outline">
                    {verifyingEmailCode ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                  </Button>
                </div>
                {user.email_verified_for_kyc && <p className="text-sm text-green-600 dark:text-green-400">Email confirmed.</p>}
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-white/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-gray-900 dark:text-white font-medium">
                  <Smartphone className="w-4 h-4 text-pink-500" />
                  Phone Verification
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Enter your phone number and verify it with SMS.
                </p>
                <input
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="+1 555 123 4567"
                  className="w-full h-10 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-[#120d1d] px-3 text-sm text-gray-900 dark:text-white"
                  disabled={user.phone_verified}
                />
                <div className="flex gap-2">
                  <Button onClick={sendPhoneCode} disabled={sendingPhoneCode || user.phone_verified} className="flex-1 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700">
                    {sendingPhoneCode ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send SMS Code'}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <input
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value)}
                    placeholder="Enter SMS code"
                    className="flex-1 h-10 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-[#120d1d] px-3 text-sm text-gray-900 dark:text-white"
                  />
                  <Button onClick={verifyPhoneCode} disabled={verifyingPhoneCode || user.phone_verified} variant="outline">
                    {verifyingPhoneCode ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                  </Button>
                </div>
                {user.phone_verified && <p className="text-sm text-green-600 dark:text-green-400">Phone verified.</p>}
              </div>
            </div>

            {/* Liveness Video */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                Liveness Verification Video
              </label>
              {selfiePreview ? (
                <div className="relative">
                  <video
                    src={selfiePreview}
                    controls
                    className="w-full rounded-lg border border-gray-200 dark:border-white/10"
                  />
                  <Button
                    onClick={() => {
                      setSelfieVideo(null);
                      setSelfiePreview(null);
                    }}
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button
                    onClick={() => startCamera('selfie')}
                    className="w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700"
                  >
                    <Video className="w-4 h-4 mr-2" />
                    Record with Camera
                  </Button>
                  <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
                    You'll be asked to turn your head left, right, up, and down
                  </p>
                </div>
              )}
            </div>

            {/* ID Document */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                Government ID
              </label>
              {idPreview ? (
                <div className="relative">
                  <img
                    src={idPreview}
                    alt="ID preview"
                    className="w-full rounded-lg border border-gray-200 dark:border-white/10"
                  />
                  <Button
                    onClick={() => {
                      setIdDocument(null);
                      setIdPreview(null);
                    }}
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button
                    onClick={() => startCamera('id')}
                    className="w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Capture with Camera
                  </Button>
                  <Button
                    onClick={() => idInputRef.current?.click()}
                    variant="outline"
                    className="w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload from Device
                  </Button>
                  <input
                    ref={idInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Important Info */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-sm text-blue-600 dark:text-blue-400">
              <ul className="space-y-2">
                <li>• Follow the head movement prompts during video recording</li>
                <li>• All information on your ID must be clearly readable</li>
                <li>• Your ID must be valid and not expired</li>
                <li>• Ensure good lighting for both video and ID photo</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => navigate(createPageUrl('Home'))}
                variant="outline"
                className="flex-1"
                disabled={uploading}
              >
                Skip for Now
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!selfieVideo || !idDocument || uploading}
                className="flex-1 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Submit Verification
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}