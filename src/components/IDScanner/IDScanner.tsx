/**
 * IDScanner Component
 * Captures front and back of ID card and driving license, extracts details using Gemini AI
 * No fallback - if AI fails, user can retry or enter manually
 */

import { useState, useRef, useEffect } from 'react';
import { X, Camera, RotateCcw, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/common';
import {
  extractIDWithGemini,
  extractLicenseWithGemini,
  loadGeminiApiKey,
  isGeminiAvailable,
  type ProcessingProgress,
} from '@/services/geminiService';
import './IDScanner.css';

export interface ScannedData {
  name: string;
  nric: string;
  dob: string;
  address: string;
  addressContinue: string;
  licenseStartDate: string;
  frontImage: string | null;
  backImage: string | null;
  licenseFrontImage: string | null;
  licenseBackImage: string | null;
}

interface IDScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onDataExtracted: (data: ScannedData) => void;
}

type Step =
  | 'front'
  | 'back'
  | 'processing'
  | 'review'
  | 'ask-license'
  | 'license-front'
  | 'license-back'
  | 'license-processing'
  | 'final-review';

export function IDScanner({ isOpen, onClose, onDataExtracted }: IDScannerProps) {
  const [step, setStep] = useState<Step>('front');
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [licenseFrontImage, setLicenseFrontImage] = useState<string | null>(null);
  const [licenseBackImage, setLicenseBackImage] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingProgress>({ stage: '', progress: 0 });
  const [confidence, setConfidence] = useState(0);
  const [editableData, setEditableData] = useState({
    name: '',
    nric: '',
    dob: '',
    address: '',
    addressContinue: '',
    licenseStartDate: '',
  });
  const [isPortraitMode, setIsPortraitMode] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      resetScanner();
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const resetScanner = () => {
    setStep('front');
    setFrontImage(null);
    setBackImage(null);
    setLicenseFrontImage(null);
    setLicenseBackImage(null);
    setError(null);
    setProcessingStatus({ stage: '', progress: 0 });
    setConfidence(0);
    setEditableData({
      name: '',
      nric: '',
      dob: '',
      address: '',
      addressContinue: '',
      licenseStartDate: '',
    });
    setIsPortraitMode(false);
    stopCamera();
  };

  const startCamera = async () => {
    try {
      setError(null);
      setCameraLoading(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      setCameraActive(true);
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (!videoRef.current) {
        setCameraLoading(false);
        setCameraActive(false);
        setError('Video element not ready. Please try again.');
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      videoRef.current.srcObject = stream;
      streamRef.current = stream;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => resolve(), 3000);
        if (videoRef.current && videoRef.current.readyState >= 1) {
          clearTimeout(timeout);
          resolve();
          return;
        }
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => {
            clearTimeout(timeout);
            resolve();
          };
          videoRef.current.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Video element error'));
          };
        }
      });

      await videoRef.current?.play();
      setCameraLoading(false);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setCameraLoading(false);
      setCameraActive(false);
      setError(`Unable to access camera: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraLoading(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    const containerAspect = isPortraitMode ? 3 / 4 : 4 / 3;
    const videoAspect = videoWidth / videoHeight;

    let cropX = 0;
    let cropY = 0;
    let cropWidth = videoWidth;
    let cropHeight = videoHeight;

    if (videoAspect > containerAspect) {
      cropWidth = videoHeight * containerAspect;
      cropX = (videoWidth - cropWidth) / 2;
    } else if (videoAspect < containerAspect) {
      cropHeight = videoWidth / containerAspect;
      cropY = (videoHeight - cropHeight) / 2;
    }

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    if (step === 'front') {
      setFrontImage(imageDataUrl);
      stopCamera();
    } else if (step === 'back') {
      setBackImage(imageDataUrl);
      stopCamera();
    } else if (step === 'license-front') {
      setLicenseFrontImage(imageDataUrl);
      stopCamera();
    } else if (step === 'license-back') {
      setLicenseBackImage(imageDataUrl);
      stopCamera();
    }
  };

  const handleRetake = () => {
    if (step === 'front') {
      setFrontImage(null);
    } else if (step === 'back') {
      setBackImage(null);
    } else if (step === 'license-front') {
      setLicenseFrontImage(null);
    } else if (step === 'license-back') {
      setLicenseBackImage(null);
    }
    startCamera();
  };

  const handleNextStep = async () => {
    if (step === 'front' && frontImage) {
      setStep('back');
    } else if (step === 'back') {
      processIDImages();
    } else if (step === 'license-front' && licenseFrontImage) {
      setStep('license-back');
    } else if (step === 'license-back') {
      processLicenseImages();
    }
  };

  const handleSkipBack = () => {
    setBackImage(null);
    processIDImages();
  };

  const handleSkipLicenseBack = () => {
    setLicenseBackImage(null);
    processLicenseImages();
  };

  const handleScanLicense = () => {
    setStep('license-front');
  };

  const handleSkipLicense = () => {
    setStep('final-review');
  };

  const processIDImages = async () => {
    if (!frontImage) return;

    setStep('processing');
    setError(null);

    try {
      // Load API key from Supabase first
      await loadGeminiApiKey();

      // Check if Gemini is available
      if (!isGeminiAvailable()) {
        setError('AI service is not available. Please check your API key in Settings or your internet connection.');
        setStep('front');
        return;
      }

      const result = await extractIDWithGemini(frontImage, backImage, setProcessingStatus);

      setConfidence(result.confidence);
      setEditableData({
        name: result.name || '',
        nric: result.nric || '',
        dob: result.dob || '',
        address: result.address || '',
        addressContinue: result.addressContinue || '',
        licenseStartDate: '',
      });
      setStep('review');
    } catch (err) {
      console.error('Processing error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process ID. Please try again.');
      setStep('front');
    }
  };

  const processLicenseImages = async () => {
    if (!licenseFrontImage) {
      setStep('final-review');
      return;
    }

    setStep('license-processing');
    setError(null);

    try {
      const licenseData = await extractLicenseWithGemini(licenseFrontImage, setProcessingStatus);
      if (licenseData.licenseStartDate) {
        setEditableData((prev) => ({
          ...prev,
          licenseStartDate: licenseData.licenseStartDate,
        }));
      }
      setStep('final-review');
    } catch (err) {
      console.warn('Failed to extract license data:', err);
      // Continue to final review even if extraction fails
      setStep('final-review');
    }
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditableData((prev) => ({ ...prev, [name]: value }));
  };

  const handleConfirmReview = () => {
    setStep('ask-license');
  };

  const handleConfirm = () => {
    onDataExtracted({
      ...editableData,
      frontImage,
      backImage,
      licenseFrontImage,
      licenseBackImage,
    });
    onClose();
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const handleManualEntry = () => {
    // Close scanner and let user enter manually
    onClose();
  };

  if (!isOpen) return null;

  const currentImage =
    step === 'front'
      ? frontImage
      : step === 'back'
        ? backImage
        : step === 'license-front'
          ? licenseFrontImage
          : step === 'license-back'
            ? licenseBackImage
            : null;

  const isLicenseStep = step === 'license-front' || step === 'license-back';
  const isProcessingStep = step === 'processing' || step === 'license-processing';

  return (
    <div className="id-scanner-overlay">
      <div className="id-scanner-modal">
        {/* Header */}
        <div className="id-scanner-header">
          <h2>
            {step === 'front' && 'Scan Front of ID'}
            {step === 'back' && 'Scan Back of ID'}
            {step === 'processing' && 'Processing ID...'}
            {step === 'review' && 'Review Extracted Data'}
            {step === 'ask-license' && 'Scan Driving License?'}
            {step === 'license-front' && 'Scan Front of License'}
            {step === 'license-back' && 'Scan Back of License'}
            {step === 'license-processing' && 'Processing License...'}
            {step === 'final-review' && 'Review All Data'}
          </h2>
          <button className="id-scanner-close" onClick={handleClose}>
            <X size={24} />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="id-scanner-progress">
          <ProgressStep number={1} label="ID Front" isActive={step === 'front'} isComplete={!!frontImage} />
          <div className="progress-line" />
          <ProgressStep
            number={2}
            label="ID Back"
            isActive={step === 'back'}
            isComplete={step !== 'front' && step !== 'back'}
          />
          <div className="progress-line" />
          <ProgressStep
            number={3}
            label="Review"
            isActive={step === 'processing' || step === 'review'}
            isComplete={step === 'ask-license' || isLicenseStep || step === 'license-processing' || step === 'final-review'}
          />
          <div className="progress-line" />
          <ProgressStep
            number={4}
            label="License"
            isActive={isLicenseStep || step === 'license-processing'}
            isComplete={!!licenseFrontImage && step === 'final-review'}
          />
          <div className="progress-line" />
          <ProgressStep number={5} label="Done" isActive={step === 'final-review'} isComplete={false} />
        </div>

        {/* Content Area */}
        <div className="id-scanner-content">
          {error && (
            <div className="id-scanner-error">
              <AlertCircle size={20} />
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={handleManualEntry}>
                Enter Manually
              </Button>
            </div>
          )}

          {/* Front/Back/License Capture Steps */}
          {(step === 'front' || step === 'back' || isLicenseStep) && (
            <div className="capture-section">
              {!cameraActive && !currentImage && !cameraLoading && (
                <div className="capture-start">
                  <div className="id-icon">{isLicenseStep ? '🚗' : step === 'front' ? '🪪' : '🔄'}</div>
                  <p className="capture-instruction">
                    {step === 'front' && 'Position the front of the ID card within the frame'}
                    {step === 'back' && 'Position the back of the ID card within the frame'}
                    {step === 'license-front' && 'Position the front of the driving license within the frame'}
                    {step === 'license-back' && 'Position the back of the driving license within the frame'}
                  </p>
                  <Button onClick={startCamera} leftIcon={<Camera size={18} />}>
                    Start Camera
                  </Button>
                </div>
              )}

              {cameraLoading && (
                <div className="loading-state">
                  <div className="loading-spinner" />
                  <p>Starting camera...</p>
                </div>
              )}

              {cameraActive && (
                <div className={`camera-view ${isPortraitMode ? 'portrait' : ''}`}>
                  <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />

                  {/* Guide Overlay */}
                  <div className="id-guide-overlay">
                    <div className={`id-guide-frame ${isPortraitMode ? 'portrait' : ''}`}>
                      <div className="corner top-left" />
                      <div className="corner top-right" />
                      <div className="corner bottom-left" />
                      <div className="corner bottom-right" />
                    </div>
                    <p className="guide-text">
                      {step === 'front' && 'Front of ID'}
                      {step === 'back' && 'Back of ID'}
                      {step === 'license-front' && 'Front of License'}
                      {step === 'license-back' && 'Back of License'}
                    </p>
                  </div>

                  <div className="camera-controls">
                    <button
                      className="btn-orientation-toggle"
                      onClick={() => setIsPortraitMode(!isPortraitMode)}
                      title={isPortraitMode ? 'Switch to Landscape' : 'Switch to Portrait'}
                    >
                      {isPortraitMode ? '📱' : '🖼️'}
                    </button>
                    <button className="btn-capture" onClick={capturePhoto}>
                      <div className="capture-ring">
                        <div className="capture-button" />
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Preview captured image */}
              {currentImage && !cameraActive && (
                <div className="preview-section">
                  <div className={`preview-image-container ${isPortraitMode ? 'portrait' : ''}`}>
                    <img src={currentImage} alt="Captured" className="preview-image" />
                  </div>
                  <div className="preview-actions">
                    <Button variant="outline" onClick={handleRetake} leftIcon={<RotateCcw size={16} />}>
                      Retake
                    </Button>
                    <Button onClick={handleNextStep} rightIcon={<ChevronRight size={16} />}>
                      {step === 'front' && 'Next: Scan Back'}
                      {step === 'back' && 'Process ID'}
                      {step === 'license-front' && 'Next: Scan Back'}
                      {step === 'license-back' && 'Finish'}
                    </Button>
                  </div>
                  {(step === 'back' || step === 'license-back') && (
                    <button
                      className="btn-text"
                      onClick={step === 'back' ? handleSkipBack : handleSkipLicenseBack}
                    >
                      Skip {step === 'back' ? 'back scan' : 'license back'}
                    </button>
                  )}
                </div>
              )}

              {/* Skip button when step is active but no capture yet */}
              {(step === 'back' || step === 'license-back') &&
                !currentImage &&
                !cameraActive &&
                !cameraLoading && (
                  <div className="skip-section">
                    <button
                      className="btn-text"
                      onClick={step === 'back' ? handleSkipBack : handleSkipLicenseBack}
                    >
                      Skip {step === 'back' ? 'back scan' : 'license back'}
                    </button>
                  </div>
                )}
            </div>
          )}

          {/* Processing Step */}
          {isProcessingStep && (
            <div className="processing-section">
              <div className="processing-animation">
                <div className="processing-icon">
                  <div className="scan-line" />
                </div>
              </div>
              <p className="processing-status">{processingStatus.stage}</p>
              <div className="processing-bar">
                <div className="processing-bar-fill" style={{ width: `${processingStatus.progress}%` }} />
              </div>
              <p className="processing-percent">{processingStatus.progress}%</p>
            </div>
          )}

          {/* Review Step */}
          {step === 'review' && (
            <div className="review-section">
              <div className="confidence-badge">
                <span className="scanner-method ai">✨ AI Scanner</span>
                <span className={`confidence ${confidence >= 75 ? 'high' : confidence >= 50 ? 'medium' : 'low'}`}>
                  {confidence}% confidence
                </span>
              </div>

              <p className="review-instruction">Review and edit the extracted information:</p>

              <div className="review-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="name">Name</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={editableData.name}
                      onChange={handleEditChange}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="nric">NRIC/FIN</label>
                    <input
                      type="text"
                      id="nric"
                      name="nric"
                      value={editableData.nric}
                      onChange={handleEditChange}
                      placeholder="S1234567A"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="dob">Date of Birth</label>
                    <input
                      type="date"
                      id="dob"
                      name="dob"
                      value={editableData.dob}
                      onChange={handleEditChange}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="address">Address</label>
                    <input
                      type="text"
                      id="address"
                      name="address"
                      value={editableData.address}
                      onChange={handleEditChange}
                      placeholder="Block, Street, Unit"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="addressContinue">Address (continued)</label>
                    <input
                      type="text"
                      id="addressContinue"
                      name="addressContinue"
                      value={editableData.addressContinue}
                      onChange={handleEditChange}
                      placeholder="SINGAPORE + Postal"
                    />
                  </div>
                </div>
              </div>

              {/* Scanned Images Preview */}
              <div className="scanned-images">
                <h4>Scanned ID Images</h4>
                <div className="image-thumbnails">
                  {frontImage && (
                    <div className="thumbnail">
                      <img src={frontImage} alt="Front of ID" />
                      <span>Front</span>
                    </div>
                  )}
                  {backImage && (
                    <div className="thumbnail">
                      <img src={backImage} alt="Back of ID" />
                      <span>Back</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="review-actions">
                <Button variant="outline" onClick={resetScanner}>
                  Scan Again
                </Button>
                <Button onClick={handleConfirmReview}>Continue</Button>
              </div>
            </div>
          )}

          {/* Ask License Step */}
          {step === 'ask-license' && (
            <div className="ask-license-section">
              <div className="ask-license-icon">🚗</div>
              <h3>Would you like to scan a driving license?</h3>
              <p className="ask-license-description">
                Scanning the driving license will extract the license start date.
              </p>
              <div className="ask-license-actions">
                <Button variant="outline" onClick={handleSkipLicense}>
                  Skip
                </Button>
                <Button onClick={handleScanLicense}>Scan License</Button>
              </div>
            </div>
          )}

          {/* Final Review Step */}
          {step === 'final-review' && (
            <div className="review-section">
              <p className="review-instruction">Review all scanned data:</p>

              <div className="review-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      name="name"
                      value={editableData.name}
                      onChange={handleEditChange}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="form-group">
                    <label>NRIC/FIN</label>
                    <input
                      type="text"
                      name="nric"
                      value={editableData.nric}
                      onChange={handleEditChange}
                      placeholder="S1234567A"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input type="date" name="dob" value={editableData.dob} onChange={handleEditChange} />
                  </div>
                  <div className="form-group">
                    <label>License Start Date</label>
                    <input
                      type="date"
                      name="licenseStartDate"
                      value={editableData.licenseStartDate}
                      onChange={handleEditChange}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Address</label>
                    <input
                      type="text"
                      name="address"
                      value={editableData.address}
                      onChange={handleEditChange}
                      placeholder="Block, Street, Unit"
                    />
                  </div>
                  <div className="form-group">
                    <label>Address (continued)</label>
                    <input
                      type="text"
                      name="addressContinue"
                      value={editableData.addressContinue}
                      onChange={handleEditChange}
                      placeholder="SINGAPORE + Postal"
                    />
                  </div>
                </div>
              </div>

              {/* All Scanned Images */}
              <div className="scanned-images">
                <h4>Scanned ID Card</h4>
                <div className="image-thumbnails">
                  {frontImage && (
                    <div className="thumbnail">
                      <img src={frontImage} alt="Front of ID" />
                      <span>Front</span>
                    </div>
                  )}
                  {backImage && (
                    <div className="thumbnail">
                      <img src={backImage} alt="Back of ID" />
                      <span>Back</span>
                    </div>
                  )}
                </div>
              </div>

              {(licenseFrontImage || licenseBackImage) && (
                <div className="scanned-images">
                  <h4>Scanned Driving License</h4>
                  <div className="image-thumbnails">
                    {licenseFrontImage && (
                      <div className="thumbnail">
                        <img src={licenseFrontImage} alt="Front of License" />
                        <span>Front</span>
                      </div>
                    )}
                    {licenseBackImage && (
                      <div className="thumbnail">
                        <img src={licenseBackImage} alt="Back of License" />
                        <span>Back</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="review-actions">
                <Button variant="outline" onClick={resetScanner}>
                  Scan Again
                </Button>
                <Button onClick={handleConfirm} leftIcon={<CheckCircle size={16} />}>
                  Use This Data
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Progress Step Component
function ProgressStep({
  number,
  label,
  isActive,
  isComplete,
}: {
  number: number;
  label: string;
  isActive: boolean;
  isComplete: boolean;
}) {
  return (
    <div className={`progress-step ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}`}>
      <span className="step-number">{isComplete ? '✓' : number}</span>
      <span className="step-label">{label}</span>
    </div>
  );
}
