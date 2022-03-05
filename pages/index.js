// import Head from "next/head";
// import Image from "next/image";
// import { useRef } from "react";
// import styles from "../styles/Home.module.css";
import React, { useRef } from "react";
import * as tf from "@tensorflow/tfjs";
import * as bodyPix from "@tensorflow-models/body-pix";

export default function Home() {
  const processedVid = useRef();
  const rawVideo = useRef();
  const startBtn = useRef();
  const closeBtn = useRef();
  const videoDownloadRef = useRef();

  const segmentationConfig = {
    internalResolution: "full",
    segmentationThreshold: 0.01,
    scoreThreshold: 0.01,
  };

  const modelConfig = {
    architecture: "MobileNetV1",
    outputStride: 16,
    multiplier: 1,
    quantBytes: 4,
  };

  let recordedChunks = [];
  let localStream = null;
  let options = { mimeType: "video/webm; codecs=vp9" };
  let mediaRecorder = null;
  let videoUrl = null;
  let model;

  const startCamHandler = async () => {
    console.log("Starting webcam and mic ..... ");
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    // console.log(model);

    //populate video element
    rawVideo.current.srcObject = localStream;
    rawVideo.current.addEventListener("loadeddata", (ev) => {
      console.log("loaded data.");
      bodyPix.load(modelConfig).then((m) => {
        console.log("model loaded successfully");
        model = m;
        transform(rawVideo.current, processedVid.current);
      });
    });

    // recording of local video from stream
    mediaRecorder = new MediaRecorder(localStream, options);
    mediaRecorder.ondataavailable = (event) => {
      console.log("data-available");
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };
    mediaRecorder.start();
  };

  const stopCamHandler = () => {
    console.log("Hanging up the call ...");
    localStream.getTracks().forEach((track) => track.stop());

    mediaRecorder.onstop = async (event) => {
      let blob = new Blob(recordedChunks, {
        type: "video/webm",
      });

      // FIXME:
      // await readFile(blob).then((encoded_file) => {
      //   uploadVideo(encoded_file);
      // });

      // process the video to remove character
      // Send the video to cloudinary
      // Run/ Display the video from cloudinary url
      //FIXME: Send data to cloudinary

      videoDownloadRef.current.href = URL.createObjectURL(blob);
      videoDownloadRef.current.download =
        new Date().getTime() + "-locastream.webm";
    };
  };

  function readFile(file) {
    console.log("readFile()=>", file);
    return new Promise(function (resolve, reject) {
      let fr = new FileReader();

      fr.onload = function () {
        resolve(fr.result);
      };

      fr.onerror = function () {
        reject(fr);
      };

      fr.readAsDataURL(file);
    });
  }

  const uploadVideo = async (base64) => {
    console.log("uploading to backend...");
    try {
      fetch("/api/upload", {
        method: "POST",
        body: JSON.stringify({ data: base64 }),
        headers: { "Content-Type": "application/json" },
      }).then((response) => {
        console.log("successfull session", response.status);
      });
    } catch (error) {
      console.error(error);
    }
  };

  let transform = (video_in, canvas_out) => {
    let c_tmp, context_out, ctx_tmp;
    context_out = canvas_out.getContext("2d");

    c_tmp = document.createElement("canvas");
    c_tmp.setAttribute("width", 800);
    c_tmp.setAttribute("height", 450);
    c_tmp.setAttribute("clientHeight", 450);
    c_tmp.setAttribute("clientWidth", 800);

    ctx_tmp = c_tmp.getContext("2d");

    computeFrame(context_out, video_in, ctx_tmp, c_tmp);
  };

  let computeFrame = (context_out, video_in, ctx_tmp, c_tmp) => {
    // let model;
    ctx_tmp.drawImage(
      video_in,
      0,
      0,
      video_in.videoWidth,
      video_in.videoHeight
    );

    let frame = ctx_tmp.getImageData(
      0,
      0,
      video_in.videoWidth,
      video_in.videoHeight
    );

    model.segmentPerson(c_tmp, segmentationConfig).then((segmentation) => {
      let output_img = context_out.getImageData(
        0,
        0,
        video_in.videoWidth,
        video_in.videoHeight
      );

      // // console.log("last log line experienced", output_img);

      for (let x = 0; x < video_in.videoWidth; x++) {
        for (let y = 0; y < video_in.videoHeight; y++) {
          let n = x + y * video_in.videoWidth;
          // // console.log("Reached here...");
          if (segmentation.data[n] == 0) {
            //   console.log("segmentation");
            output_img.data[n * 4] = frame.data[n * 4]; // R
            output_img.data[n * 4 + 1] = frame.data[n * 4 + 1]; // G
            output_img.data[n * 4 + 2] = frame.data[n * 4 + 2]; // B
            output_img.data[n * 4 + 3] = frame.data[n * 4 + 3]; // A
          }
          // else {
          // //   console.log("Didnt meet target...");
          // // }
          // console.log(segmentation.data[n]);
        }
      }
      // console.log(output_img);
      context_out.putImageData(output_img, 0, 0);
      setTimeout(computeFrame, 0, context_out, video_in, ctx_tmp, c_tmp);
    });
  };

  return (
    <div>
      <video
        width={800}
        height={450}
        ref={rawVideo}
        autoPlay
        playsInline
      ></video>
      <br />
      <canvas width={800} height={450} ref={processedVid}></canvas>
      <br />

      <button onClick={startCamHandler} ref={startBtn}>
        Start Webcam
      </button>
      <button onClick={stopCamHandler} ref={closeBtn}>
        Close Webcam
      </button>
      <button>
        <a ref={videoDownloadRef} href={videoUrl}>
          Download video
        </a>
      </button>
    </div>
  );
}
