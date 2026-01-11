/**
 * IDScanner Component
 * Captures front and back of ID card and driving license, extracts details using Gemini AI
 * No fallback - if AI fails, user can retry or enter manually
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  X,
  Warning,
  Camera,
  ArrowCounterClockwise,
  ArrowRight,
  Check,
  Car,
  IdentificationCard,
  Sparkle,
  DeviceMobileCamera,
  Image,
} from '@phosphor-icons/react'
import { Button } from '@/components/common'
import { getSupabase } from '@/lib/supabase'
import {
  extractIDWithGemini,
  extractLicenseWithGemini,
  loadGeminiApiKey,
  isGeminiAvailable,
  preWarmEdgeFunction,
  type ProcessingProgress,
} from '@/services/geminiService'
import './IDScanner.css'

// Guide frame dimensions (must match CSS)
const GUIDE_FRAME_WIDTH_PERCENT = 0.85 // 85% of container
const GUIDE_FRAME_ASPECT_RATIO = 1.586 // Credit card ratio (landscape)
const GUIDE_FRAME_WIDTH_PERCENT_PORTRAIT = 0.75 // 75% for portrait
const GUIDE_FRAME_ASPECT_RATIO_PORTRAIT = 0.65 // Portrait ratio

// AI image settings (optimized for faster processing)
const AI_IMAGE_MAX_WIDTH = 1024
const AI_IMAGE_QUALITY = 0.75

export interface ScannedData {
  name: string
  nric: string
  dob: string
  address: string
  addressContinue: string
  licenseStartDate: string
  frontImage: string | null
  backImage: string | null
  licenseFrontImage: string | null
  licenseBackImage: string | null
}

interface IDScannerProps {
  isOpen: boolean
  onClose: () => void
  onDataExtracted: (data: ScannedData) => void
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
  | 'final-review'

export function IDScanner({ isOpen, onClose, onDataExtracted }: IDScannerProps) {
  const [step, setStep] = useState<Step>('front')
  // Full resolution images for saving
  const [frontImage, setFrontImage] = useState<string | null>(null)
  const [backImage, setBackImage] = useState<string | null>(null)
  const [licenseFrontImage, setLicenseFrontImage] = useState<string | null>(null)
  const [licenseBackImage, setLicenseBackImage] = useState<string | null>(null)
  // Optimized images for AI processing (smaller, lower quality)
  const [frontImageAI, setFrontImageAI] = useState<string | null>(null)
  const [backImageAI, setBackImageAI] = useState<string | null>(null)
  const [licenseFrontImageAI, setLicenseFrontImageAI] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [processingStatus, setProcessingStatus] = useState<ProcessingProgress>({
    stage: '',
    progress: 0,
  })
  const [confidence, setConfidence] = useState(0)
  const [editableData, setEditableData] = useState({
    name: '',
    nric: '',
    dob: '',
    address: '',
    addressContinue: '',
    licenseStartDate: '',
  })
  const [isPortraitMode, setIsPortraitMode] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const aiCanvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Pre-warm auth and edge function when modal opens
  const preWarm = useCallback(async () => {
    try {
      await Promise.all([getSupabase().auth.getUser(), preWarmEdgeFunction()])
    } catch {
      // Ignore errors - this is just pre-warming
    }
  }, [])

  // Reset state and pre-warm when modal opens
  useEffect(() => {
    if (isOpen) {
      resetScanner()
      void preWarm() // Pre-warm auth and edge function while user positions camera
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, preWarm])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  // Ref to store pending front image processing result (declared early for use in resetScanner)
  const pendingFrontProcessingRef = useRef<Promise<
    import('@/services/geminiService').ExtractedIDData
  > | null>(null)

  const resetScanner = () => {
    setStep('front')
    setFrontImage(null)
    setBackImage(null)
    setLicenseFrontImage(null)
    setLicenseBackImage(null)
    setFrontImageAI(null)
    setBackImageAI(null)
    setLicenseFrontImageAI(null)
    setError(null)
    setProcessingStatus({ stage: '', progress: 0 })
    setConfidence(0)
    setEditableData({
      name: '',
      nric: '',
      dob: '',
      address: '',
      addressContinue: '',
      licenseStartDate: '',
    })
    setIsPortraitMode(false)
    pendingFrontProcessingRef.current = null
    stopCamera()
  }

  const startCamera = async () => {
    try {
      setError(null)
      setCameraLoading(true)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })

      setCameraActive(true)
      await new Promise((resolve) => setTimeout(resolve, 100))

      if (!videoRef.current) {
        setCameraLoading(false)
        setCameraActive(false)
        setError('Video element not ready. Please try again.')
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      videoRef.current.srcObject = stream
      streamRef.current = stream

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => resolve(), 3000)
        if (videoRef.current && videoRef.current.readyState >= 1) {
          clearTimeout(timeout)
          resolve()
          return
        }
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => {
            clearTimeout(timeout)
            resolve()
          }
          videoRef.current.onerror = () => {
            clearTimeout(timeout)
            reject(new Error('Video element error'))
          }
        }
      })

      await videoRef.current?.play()
      setCameraLoading(false)
    } catch (err) {
      console.error('Error accessing camera:', err)
      setCameraLoading(false)
      setCameraActive(false)
      setError(`Unable to access camera: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
    setCameraLoading(false)
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !aiCanvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const aiCanvas = aiCanvasRef.current

    const videoWidth = video.videoWidth
    const videoHeight = video.videoHeight

    // Calculate the visible container area (what's shown on screen)
    const containerAspect = isPortraitMode ? 3 / 4 : 4 / 3
    const videoAspect = videoWidth / videoHeight

    let containerCropX = 0
    let containerCropY = 0
    let containerCropWidth = videoWidth
    let containerCropHeight = videoHeight

    // First, crop to the container's visible area (object-fit: cover)
    if (videoAspect > containerAspect) {
      containerCropWidth = videoHeight * containerAspect
      containerCropX = (videoWidth - containerCropWidth) / 2
    } else if (videoAspect < containerAspect) {
      containerCropHeight = videoWidth / containerAspect
      containerCropY = (videoHeight - containerCropHeight) / 2
    }

    // Now calculate the guide frame area within the container
    const guideWidthPercent = isPortraitMode
      ? GUIDE_FRAME_WIDTH_PERCENT_PORTRAIT
      : GUIDE_FRAME_WIDTH_PERCENT
    const guideAspectRatio = isPortraitMode
      ? GUIDE_FRAME_ASPECT_RATIO_PORTRAIT
      : GUIDE_FRAME_ASPECT_RATIO

    // Guide frame dimensions relative to container
    const guideWidth = containerCropWidth * guideWidthPercent
    const guideHeight = guideWidth / guideAspectRatio

    // Center the guide frame within the container
    const guideX = containerCropX + (containerCropWidth - guideWidth) / 2
    const guideY = containerCropY + (containerCropHeight - guideHeight) / 2

    // Full resolution image (cropped to guide frame)
    canvas.width = guideWidth
    canvas.height = guideHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, guideX, guideY, guideWidth, guideHeight, 0, 0, guideWidth, guideHeight)
    const fullResImage = canvas.toDataURL('image/jpeg', 0.95)

    // AI-optimized image (smaller, lower quality for faster processing)
    const scale = Math.min(1, AI_IMAGE_MAX_WIDTH / guideWidth)
    const aiWidth = Math.round(guideWidth * scale)
    const aiHeight = Math.round(guideHeight * scale)
    aiCanvas.width = aiWidth
    aiCanvas.height = aiHeight
    const aiCtx = aiCanvas.getContext('2d')
    if (!aiCtx) return
    aiCtx.drawImage(video, guideX, guideY, guideWidth, guideHeight, 0, 0, aiWidth, aiHeight)
    // Use WebP for smaller file size (25-35% smaller than JPEG)
    const aiImage = aiCanvas.toDataURL('image/webp', AI_IMAGE_QUALITY)

    if (step === 'front') {
      setFrontImage(fullResImage)
      setFrontImageAI(aiImage)
      stopCamera()
    } else if (step === 'back') {
      setBackImage(fullResImage)
      setBackImageAI(aiImage)
      stopCamera()
    } else if (step === 'license-front') {
      setLicenseFrontImage(fullResImage)
      setLicenseFrontImageAI(aiImage)
      stopCamera()
    } else if (step === 'license-back') {
      setLicenseBackImage(fullResImage)
      // No AI image needed for license back (not used for extraction)
      stopCamera()
    }
  }

  const handleRetake = () => {
    if (step === 'front') {
      setFrontImage(null)
      setFrontImageAI(null)
    } else if (step === 'back') {
      setBackImage(null)
      setBackImageAI(null)
    } else if (step === 'license-front') {
      setLicenseFrontImage(null)
      setLicenseFrontImageAI(null)
    } else if (step === 'license-back') {
      setLicenseBackImage(null)
    }
    void startCamera()
  }

  const handleNextStep = () => {
    if (step === 'front' && frontImage) {
      setStep('back')
    } else if (step === 'back') {
      void processIDImages()
    } else if (step === 'license-front' && licenseFrontImage) {
      setStep('license-back')
    } else if (step === 'license-back') {
      void processLicenseImages()
    }
  }

  const handleSkipBack = () => {
    setBackImage(null)
    setBackImageAI(null)
    void processIDImages()
  }

  const handleSkipLicenseBack = () => {
    setLicenseBackImage(null)
    void processLicenseImages()
  }

  const handleScanLicense = () => {
    setStep('license-front')
  }

  const handleSkipLicense = () => {
    setStep('final-review')
  }

  // Start processing front image immediately after capture (parallel with back scan)
  useEffect(() => {
    if (frontImageAI && step === 'back' && !pendingFrontProcessingRef.current) {
      // Start processing front image in background while user scans back
      console.log('Starting parallel front image processing...')
      pendingFrontProcessingRef.current = extractIDWithGemini(frontImageAI, null, () => {})
    }
  }, [frontImageAI, step])

  const processIDImages = async () => {
    if (!frontImageAI) return

    setStep('processing')
    setError(null)

    try {
      // Load API key from Supabase first (should be quick if pre-warmed)
      await loadGeminiApiKey()

      // Check if service is available
      if (!isGeminiAvailable()) {
        setError('AI service is not available. Please check your internet connection.')
        setStep('front')
        return
      }

      // Clear any pending processing
      pendingFrontProcessingRef.current = null

      // Process both front and back images in a single call
      setProcessingStatus({ stage: 'Analyzing ID with AI...', progress: 10 })
      const result = await extractIDWithGemini(frontImageAI, backImageAI, setProcessingStatus)

      setConfidence(result.confidence)
      setEditableData({
        name: result.name ?? '',
        nric: result.nric ?? '',
        dob: result.dob ?? '',
        address: result.address ?? '',
        addressContinue: result.addressContinue ?? '',
        licenseStartDate: '',
      })
      setStep('review')
    } catch (err) {
      console.error('Processing error:', err)
      pendingFrontProcessingRef.current = null
      setError(err instanceof Error ? err.message : 'Failed to process ID. Please try again.')
      setStep('front')
    }
  }

  const processLicenseImages = async () => {
    if (!licenseFrontImageAI) {
      setStep('final-review')
      return
    }

    setStep('license-processing')
    setError(null)

    try {
      const licenseData = await extractLicenseWithGemini(licenseFrontImageAI, setProcessingStatus)
      if (licenseData.licenseStartDate) {
        setEditableData((prev) => ({
          ...prev,
          licenseStartDate: licenseData.licenseStartDate,
        }))
      }
      setStep('final-review')
    } catch (err) {
      console.warn('Failed to extract license data:', err)
      // Continue to final review even if extraction fails
      setStep('final-review')
    }
  }

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setEditableData((prev) => ({ ...prev, [name]: value }))
  }

  const handleConfirmReview = () => {
    setStep('ask-license')
  }

  const handleConfirm = () => {
    onDataExtracted({
      ...editableData,
      frontImage,
      backImage,
      licenseFrontImage,
      licenseBackImage,
    })
    onClose()
  }

  const handleClose = () => {
    stopCamera()
    onClose()
  }

  const handleManualEntry = () => {
    // Close scanner and let user enter manually
    onClose()
  }

  if (!isOpen) return null

  const currentImage =
    step === 'front'
      ? frontImage
      : step === 'back'
        ? backImage
        : step === 'license-front'
          ? licenseFrontImage
          : step === 'license-back'
            ? licenseBackImage
            : null

  const isLicenseStep = step === 'license-front' || step === 'license-back'
  const isProcessingStep = step === 'processing' || step === 'license-processing'

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
            <X size={20} className="close-icon" />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="id-scanner-progress">
          <ProgressStep
            number={1}
            label="ID Front"
            isActive={step === 'front'}
            isComplete={!!frontImage}
          />
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
            isComplete={
              step === 'ask-license' ||
              isLicenseStep ||
              step === 'license-processing' ||
              step === 'final-review'
            }
          />
          <div className="progress-line" />
          <ProgressStep
            number={4}
            label="License"
            isActive={isLicenseStep || step === 'license-processing'}
            isComplete={!!licenseFrontImage && step === 'final-review'}
          />
          <div className="progress-line" />
          <ProgressStep
            number={5}
            label="Done"
            isActive={step === 'final-review'}
            isComplete={false}
          />
        </div>

        {/* Content Area */}
        <div className="id-scanner-content">
          {error && (
            <div className="id-scanner-error">
              <Warning size={20} className="error-icon" />
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
                  <div className="id-icon">
                    {isLicenseStep ? (
                      <Car size={48} />
                    ) : step === 'front' ? (
                      <IdentificationCard size={48} />
                    ) : (
                      <ArrowCounterClockwise size={48} />
                    )}
                  </div>
                  <p className="capture-instruction">
                    {step === 'front' && 'Position the front of the ID card within the frame'}
                    {step === 'back' && 'Position the back of the ID card within the frame'}
                    {step === 'license-front' &&
                      'Position the front of the driving license within the frame'}
                    {step === 'license-back' &&
                      'Position the back of the driving license within the frame'}
                  </p>
                  <Button onClick={startCamera} leftIcon={<Camera size={16} />}>
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
                  <canvas ref={aiCanvasRef} style={{ display: 'none' }} />

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
                      {isPortraitMode ? <DeviceMobileCamera size={24} /> : <Image size={24} />}
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
                    <Button
                      variant="outline"
                      onClick={handleRetake}
                      leftIcon={<ArrowCounterClockwise size={16} />}
                    >
                      Retake
                    </Button>
                    <Button onClick={handleNextStep} rightIcon={<ArrowRight size={16} />}>
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
                <div
                  className="processing-bar-fill"
                  style={{ width: `${processingStatus.progress}%` }}
                />
              </div>
              <p className="processing-percent">{processingStatus.progress}%</p>
            </div>
          )}

          {/* Review Step */}
          {step === 'review' && (
            <div className="review-section">
              <div className="confidence-badge">
                <span className="scanner-method ai">
                  <Sparkle size={14} /> AI Scanner
                </span>
                <span
                  className={`confidence ${confidence >= 75 ? 'high' : confidence >= 50 ? 'medium' : 'low'}`}
                >
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
              <div className="ask-license-icon">
                <Car size={48} />
              </div>
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
                    <input
                      type="date"
                      name="dob"
                      value={editableData.dob}
                      onChange={handleEditChange}
                    />
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

              {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- truthiness check for conditional rendering */}
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
                <Button onClick={handleConfirm} leftIcon={<Check size={16} weight="bold" />}>
                  Use This Data
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Progress Step Component
function ProgressStep({
  number,
  label,
  isActive,
  isComplete,
}: {
  number: number
  label: string
  isActive: boolean
  isComplete: boolean
}) {
  return (
    <div className={`progress-step ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}`}>
      <span className="step-number">{isComplete ? <Check size={12} weight="bold" /> : number}</span>
      <span className="step-label">{label}</span>
    </div>
  )
}
