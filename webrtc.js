
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

    async start(localStream, initiator) {
        this.close();

        this.stream = localStream;

        const peer = new RTCPeerConnection({
            iceServers: [
                {
                    urls: "stun:stun.l.google.com:19302"
                }
            ]
        });

        this.peer = peer;

        peer.onicecandidate = (event) => {
            if (this.peer !== peer) return;

            if (event.candidate) {
                this.socket.emit("webrtc-ice-candidate", {
                    candidate: event.candidate
                });
            }
        };

        peer.ontrack = (event) => {
            if (this.peer !== peer) return;

            const remoteStream = event.streams[0];

            if (!remoteStream) return;

            this.remoteVideo.srcObject = remoteStream;
            this.remoteVideo.hidden = false;

            const placeholder =
                document.getElementById("strangerPlaceholder");

            if (placeholder) {
                placeholder.hidden = true;
            }

            this.remoteVideo.play().catch((error) => {
                console.error("Remote video playback error:", error);
            });

            this.onStatus("Remote media received.");
        };

        peer.onconnectionstatechange = () => {
            if (this.peer !== peer) return;

            this.onStatus(
                "WebRTC: " + peer.connectionState
            );
        };

        localStream.getTracks().forEach((track) => {
            peer.addTrack(track, localStream);
        });

        if (initiator) {
            const offer = await peer.createOffer();

            if (this.peer !== peer) return;

            await peer.setLocalDescription(offer);

            if (this.peer !== peer) return;

            this.socket.emit("webrtc-offer", {
                offer: peer.localDescription
            });
        }
    }

    async handleOffer(offer) {
        if (!this.peer) return;

        const peer = this.peer;

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
    }

    async handleAnswer(answer) {
        if (!this.peer) return;

        const peer = this.peer;

        await peer.setRemoteDescription(answer);

        if (this.peer !== peer) return;

        await this.flushCandidates();
    }

    async addCandidate(candidate) {
        if (!this.peer) return;

        if (!this.peer.remoteDescription) {
            this.pendingCandidates.push(candidate);
            return;
        }

        await this.peer.addIceCandidate(candidate);
    }

    async flushCandidates() {
        if (!this.peer) return;

        const candidates = this.pendingCandidates;
        this.pendingCandidates = [];

        for (const candidate of candidates) {
            await this.peer.addIceCandidate(candidate);
        }
    }

    // ========================================
    // CAMERA ON / OFF DURING CALL
    // ========================================

    setCameraEnabled(enabled) {
        if (!this.stream) return false;

        const videoTracks = this.stream.getVideoTracks();

        if (videoTracks.length === 0) {
            return false;
        }

        videoTracks.forEach((track) => {
            if (track.readyState === "live") {
                track.enabled = enabled;
            }
        });

        return true;
    }

    // ========================================
    // MICROPHONE ON / OFF DURING CALL
    // ========================================

    setMicrophoneEnabled(enabled) {
        if (!this.stream) return false;

        const audioTracks = this.stream.getAudioTracks();

        if (audioTracks.length === 0) {
            return false;
        }

        audioTracks.forEach((track) => {
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
        if (this.peer) {
            this.peer.onicecandidate = null;
            this.peer.ontrack = null;
            this.peer.onconnectionstatechange = null;

            this.peer.close();
            this.peer = null;
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
