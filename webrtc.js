
export class YappoWebRTC {
    constructor(socket, localVideo, remoteVideo, onStatus) {
        this.socket = socket;
        this.localVideo = localVideo;
        this.remoteVideo = remoteVideo;
        this.onStatus = onStatus;

        this.peer = null;
        this.stream = null;
        this.pendingCandidates = [];
    }

    // ========================================
    // START WEBRTC CONNECTION
    // ========================================

    async start(localStream, initiator) {
        this.close();

        this.stream = localStream;

        const peer = new RTCPeerConnection({
            iceServers: [
                {
                    urls: "stun:stun.l.google.com:19302"
                },
                {
                    urls: "stun:stun1.l.google.com:19302"
                },
                {
                    urls: "stun:stun2.l.google.com:19302"
                }
            ],
            iceCandidatePoolSize: 10
        });

        this.peer = peer;

        console.log("WebRTC peer connection created.");

        // SEND ICE CANDIDATES

        peer.onicecandidate = (event) => {
            if (this.peer !== peer) return;

            if (event.candidate) {
                this.socket.emit("webrtc-ice-candidate", {
                    candidate: event.candidate
                });
            }
        };

        // RECEIVE REMOTE VIDEO

        peer.ontrack = (event) => {
            if (this.peer !== peer) return;

            const remoteStream = event.streams[0];

            if (!remoteStream) {
                console.warn("Remote track has no stream.");
                return;
            }

            if (this.remoteVideo.srcObject !== remoteStream) {
                this.remoteVideo.srcObject = remoteStream;
            }

            this.remoteVideo.hidden = false;
            this.remoteVideo.autoplay = true;
            this.remoteVideo.playsInline = true;

            const placeholder =
                document.getElementById("strangerPlaceholder");

            if (placeholder) {
                placeholder.hidden = true;
            }

            const video = this.remoteVideo;

            video.play().catch((error) => {
                if (
                    error.name === "AbortError" ||
                    error.name === "NotAllowedError"
                ) {
                    console.warn(
                        "Remote video playback interrupted:",
                        error.message
                    );
                } else {
                    console.error(
                        "Remote video playback error:",
                        error
                    );
                }
            });

            this.onStatus("Remote media received.");
        };

        // CONNECTION STATUS

        peer.onconnectionstatechange = () => {
            if (this.peer !== peer) return;

            const state = peer.connectionState;

            console.log("WebRTC connection state:", state);

            if (state === "connected") {
                this.onStatus("Video connected!");
            } else if (state === "connecting") {
                this.onStatus("Connecting video...");
            } else if (state === "disconnected") {
                this.onStatus("Video connection interrupted.");
            } else if (state === "failed") {
                this.onStatus("WebRTC: failed");

                console.error(
                    "WebRTC connection failed. " +
                    "A TURN relay may be required."
                );
            } else if (state === "closed") {
                this.onStatus("Video connection closed.");
            }
        };

        // ICE CONNECTION DIAGNOSTICS

        peer.oniceconnectionstatechange = () => {
            if (this.peer !== peer) return;

            console.log(
                "ICE connection state:",
                peer.iceConnectionState
            );
        };

        peer.onicegatheringstatechange = () => {
            if (this.peer !== peer) return;

            console.log(
                "ICE gathering state:",
                peer.iceGatheringState
            );
        };

        // ADD LOCAL CAMERA AND MICROPHONE

        localStream.getTracks().forEach((track) => {
            if (track.readyState === "live") {
                peer.addTrack(track, localStream);
            }
        });

        // CREATE OFFER

        if (initiator) {
            const offer = await peer.createOffer();

            if (this.peer !== peer) return;

            await peer.setLocalDescription(offer);

            if (this.peer !== peer) return;

            this.socket.emit("webrtc-offer", {
                offer: peer.localDescription
            });

            console.log("WebRTC offer sent.");
        }
    }

    // ========================================
    // HANDLE OFFER
    // ========================================

    async handleOffer(offer) {
        const peer = this.peer;

        if (!peer || peer.signalingState === "closed") {
            return;
        }

        try {
            await peer.setRemoteDescription(offer);

            if (this.peer !== peer) return;

            await this.flushCandidates();

            const answer = await peer.createAnswer();

            if (this.peer !== peer) return;

            await peer.setLocalDescription(answer);

            if (this.peer !== peer) return;

            this.socket.emit("webrtc-answer", {
                answer: peer.localDescription
            });

            console.log("WebRTC answer sent.");

        } catch (error) {
            if (this.peer === peer) {
                console.error(
                    "Error handling WebRTC offer:",
                    error
                );
            }
        }
    }

    // ========================================
    // HANDLE ANSWER
    // ========================================

    async handleAnswer(answer) {
        const peer = this.peer;

        if (!peer || peer.signalingState === "closed") {
            return;
        }

        try {
            await peer.setRemoteDescription(answer);

            if (this.peer !== peer) return;

            await this.flushCandidates();

            console.log("WebRTC answer received.");

        } catch (error) {
            if (this.peer === peer) {
                console.error(
                    "Error handling WebRTC answer:",
                    error
                );
            }
        }
    }

    // ========================================
    // HANDLE ICE CANDIDATES
    // ========================================

    async addCandidate(candidate) {
        const peer = this.peer;

        if (!peer || !candidate) return;

        if (!peer.remoteDescription) {
            this.pendingCandidates.push(candidate);
            return;
        }

        try {
            await peer.addIceCandidate(candidate);
        } catch (error) {
            if (this.peer === peer) {
                console.error(
                    "Error adding ICE candidate:",
                    error
                );
            }
        }
    }

    async flushCandidates() {
        const peer = this.peer;

        if (!peer || !peer.remoteDescription) {
            return;
        }

        const candidates = this.pendingCandidates;
        this.pendingCandidates = [];

        for (const candidate of candidates) {
            if (this.peer !== peer) return;

            try {
                await peer.addIceCandidate(candidate);
            } catch (error) {
                console.error(
                    "Error flushing ICE candidate:",
                    error
                );
            }
        }
    }

    // ========================================
    // CAMERA ON / OFF
    // ========================================

    setCameraEnabled(enabled) {
        if (!this.stream) return false;

        const tracks = this.stream.getVideoTracks();

        if (tracks.length === 0) return false;

        tracks.forEach((track) => {
            if (track.readyState === "live") {
                track.enabled = enabled;
            }
        });

        return true;
    }

    // ========================================
    // MICROPHONE ON / OFF
    // ========================================

    setMicrophoneEnabled(enabled) {
        if (!this.stream) return false;

        const tracks = this.stream.getAudioTracks();

        if (tracks.length === 0) return false;

        tracks.forEach((track) => {
            if (track.readyState === "live") {
                track.enabled = enabled;
            }
        });

        return true;
    }

    // ========================================
    // CLEANUP
    // ========================================

    close() {
        const peer = this.peer;

        this.peer = null;

        if (peer) {
            peer.onicecandidate = null;
            peer.ontrack = null;
            peer.onconnectionstatechange = null;
            peer.oniceconnectionstatechange = null;
            peer.onicegatheringstatechange = null;

            peer.close();
        }

        this.stream = null;
        this.pendingCandidates = [];

        this.remoteVideo.pause();
        this.remoteVideo.srcObject = null;
        this.remoteVideo.hidden = true;

        const placeholder =
            document.getElementById("strangerPlaceholder");

        if (placeholder) {
            placeholder.hidden = false;
        }
    }
}
