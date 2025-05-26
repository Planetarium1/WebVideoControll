import Image from "next/image";
import { useState, useEffect } from "react";
import Link from "next/link";

interface FileItem {
  name: string;
  type: 'image' | 'video' | 'other';
  size?: number;
  lastModified?: string;
}

export default function Home() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isWarping, setIsWarping] = useState(false);

  useEffect(() => {
    // Загрузка файлов из API
    const fetchFiles = async () => {
      try {
        const response = await fetch('/api/files');
        const data = await response.json();
        setFiles(data.files || []);
      } catch (error) {
        console.error('Error fetching files:', error);
        // Fallback to mock data if API fails
        const mockFiles: FileItem[] = [
          { name: "next.svg", type: "image" },
          { name: "vercel.svg", type: "image" },
          { name: "file.svg", type: "image" },
          { name: "window.svg", type: "image" },
          { name: "globe.svg", type: "image" },
        ];
        setFiles(mockFiles);
      }
    };

    fetchFiles();
  }, []);

  const handlePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    setIsPlaying(false);
  };

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleWarping = () => {
    setIsWarping(!isWarping);
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image':
        return '🖼️';
      case 'video':
        return '🎥';
      default:
        return '📄';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Media Player
            </h1>
            <Link 
              href="/geometry-editor"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Geometry Editor
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* File List */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Files in Public Folder
                </h2>
              </div>
              <div className="p-4">
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.name}
                      className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedFile === file.name
                          ? 'bg-blue-100 dark:bg-blue-900 border-blue-300'
                          : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                      }`}
                      onClick={() => setSelectedFile(file.name)}
                    >
                      <span className="text-2xl mr-3">{getFileIcon(file.type)}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {file.type}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Media Viewer */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Media Viewer
                </h2>
              </div>
              <div className="p-4">
                {/* Media Display Area */}
                <div className={`bg-gray-100 dark:bg-gray-800 rounded-lg mb-4 flex items-center justify-center ${
                  isFullscreen ? 'fixed inset-0 z-50 bg-black' : 'h-96'
                }`}>
                  {selectedFile ? (
                    <div className={`relative ${isWarping ? 'transform perspective-1000 rotate-y-12' : ''}`}>
                      {selectedFile.endsWith('.svg') || selectedFile.endsWith('.jpg') || selectedFile.endsWith('.png') ? (
                        <Image
                          src={`/${selectedFile}`}
                          alt={selectedFile}
                          width={isFullscreen ? 800 : 400}
                          height={isFullscreen ? 600 : 300}
                          className="object-contain"
                        />
                      ) : selectedFile.endsWith('.mp4') ? (
                        <video
                          width={isFullscreen ? 800 : 400}
                          height={isFullscreen ? 600 : 300}
                          controls={isPlaying}
                          className="object-contain"
                        >
                          <source src={`/${selectedFile}`} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                      ) : (
                        <div className="text-center text-gray-500 dark:text-gray-400">
                          <p>Preview not available for this file type</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 dark:text-gray-400">
                      <p>Select a file to preview</p>
                    </div>
                  )}
                </div>

                {/* Control Buttons */}
                <div className="flex flex-wrap gap-4 justify-center">
                  <button
                    onClick={handlePlay}
                    disabled={!selectedFile}
                    className={`flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${
                      isPlaying
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    } disabled:bg-gray-300 disabled:cursor-not-allowed`}
                  >
                    {isPlaying ? (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Pause
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        Play
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleStop}
                    disabled={!selectedFile}
                    className="flex items-center px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                    </svg>
                    Stop
                  </button>

                  <button
                    onClick={handleFullscreen}
                    disabled={!selectedFile}
                    className={`flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${
                      isFullscreen
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    } disabled:bg-gray-300 disabled:cursor-not-allowed`}
                  >
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  </button>

                  <button
                    onClick={handleWarping}
                    disabled={!selectedFile}
                    className={`flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${
                      isWarping
                        ? 'bg-orange-600 hover:bg-orange-700 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    } disabled:bg-gray-300 disabled:cursor-not-allowed`}
                  >
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                    {isWarping ? 'Disable Warping' : 'Enable Warping'}
                  </button>
                </div>

                {/* File Info */}
                {selectedFile && (
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      File Information
                    </h3>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      <p><strong>Name:</strong> {selectedFile}</p>
                      <p><strong>Type:</strong> {files.find(f => f.name === selectedFile)?.type}</p>
                      <p><strong>Status:</strong> {isPlaying ? 'Playing' : 'Stopped'}</p>
                      <p><strong>Warping:</strong> {isWarping ? 'Enabled' : 'Disabled'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
