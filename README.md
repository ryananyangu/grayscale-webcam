### Create a gray-scale webcam  with nextjs

## Introduction

In this article demonstrates how we can change a wedbcam background color to grayscale.

## Codesandbox

Locate project demo on [Codesandbox](/).

<CodeSandbox
title="design cards"
id=" "
/>


You can also find the github repo this [Link](/).

## Prerequisites

Entry-level knowledge in javascript and React and or Nextjs.

##  Project setup

Create a new nextjs project with `npx create-next-app webcamgrayscale`.
The project will involve both frontend and backend. We will begin with our backend. Head to the project using terminal with `cd webcamgrayscale`.

The backend intergration involves [Cloudinary](https://cloudinary.com/?ap=em) intergration.  You will be required to create a new cloudinary account or login to your existing account using this [link](https://cloudinary.com/console). 
After login you will be given a dashboard containing environment variables necessary to intergrate cloudinary to your project. We will use the `name`, `api key` and `api secret` to implement this. 

Head to your project root directory and create a file named `.env.local`.
Inside it paste the following code

```
".env.local"

CLOUDINARY_CLOUD_NAME =

CLOUDINARY_API_KEY =

CLOUDINARY_API_SECRET=
```
Fill the code above with the environment variables from the cloudinary dashboard and restart your project using `npm run dev` 

In the `pages/api` directory, create a new file named `upload.js` which will contain our backend code.

Begin by downloading `cloudinary` to your dependancies: `npm install cloudinary`

Paste the following code to configure the environment keys and libraries.
 
```
"pages/api/upload.js"

var cloudinary = require("cloudinary").v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
```
Conclude the backend by creating handle function configure the API POST request. The function below will receive the request body from front end, upload it to cloudinary and send bacl the file's cloudinary link as a response.

```
"pages/api/upload.js"

export default async function handler(req, res) {
    if (req.method === "POST") {
        let url = ""
        try {
            let fileStr = req.body.data;
            const uploadedResponse = await cloudinary.uploader.upload_large(
                fileStr,
                {
                    resource_type: "video",
                    chunk_size: 6000000,
                }
            );
            url = uploadedResponse.url
        } catch (error) {
            res.status(500).json({ error: "Something wrong" });
        }

        res.status(200).json({data: url});
    }
}
```
For our front end, our codes will be stored in the in the `pages/index` directory.
We will need  [Tensorflow](https://www.tensorflow.org/js) and  [BodyPix](https://github.com/tensorflow/tfjs-models/tree/master/body-pix) for this to work.

Import them in your component
```
"pages/index"

import React, { useRef, useEffect, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as bodyPix from "@tensorflow-models/body-pix";
```
 
BodyPix will serve the neural network nature. We use `MobileNetV1`  to provide a faster architecture compared to `ResNet50` . It will however be less accurate than `ResNet50`. We will include the `outputStride`, `multiplier` and `quantBytes` settings to achieve a more segmented accuracy in our case.

```
"pages/index"

const modelConfig = {
  architecture: "MobileNetV1",
  outputStride: 16,
  multiplier: 1,
  quantBytes: 4,
};
```

Inside the root component declare the following variables. We will use them as we proceed.

```
"pages/index"

    let ctx_out, video_in, ctx_tmp, c_tmp, c_out;
```

Create variables to refference the DOM elements via `ref` attribute.

```
"pages/index"


  const processedVid = useRef();
  const rawVideo = useRef();
  const startBtn = useRef();
  const closeBtn = useRef();
  const videoDownloadRef = useRef();
  const [model, setModel] = useState(null);

```

Use the `useEffect` hook to perfom side effects. The side effect in our case will be to load the bodyPix model with the model configuration.
```
"pages/index"

useEffect(() => {
    if (model) return;
    const start_time = Date.now() / 1000;

    bodyPix.load(modelConfig).then((m) => {
      setModel(m);
      const end_time = Date.now() / 1000;
      console.log(`model loaded successfully, ${end_time - start_time}`);
    });

}, []);

```

Include the segmentation onfiguration. Ensure to set full internal resolution meaning there will be no resizing the input image.
Set the segmentation threshold to 0.04 which configures the minimum confident threshold before each pixel is considered part of human body.
The score threshold will be 0.4 to set the minimum threshold to recognize human body.
The webcam videos will be automatically flipped horizontally in our case. To avoid this, set the flip horizontal setting to true and finaly set the maximum detection to 1 to determine the maximum number of detections per image.

```
"pages/index"

  const segmentationConfig = {
    internalResolution: "full",
    segmentationThreshold: 0.1,
    scoreThreshold: 0.4,
    flipHorizontal: true,
    maxDetections: 1,
  };
```

Next, declare the variables below

"pages/index"

  let recordedChunks = [];
  let localStream = null;
  let options = { mimeType: "video/webm; codecs=vp9" };
  let mediaRecorder = null;
  let videoUrl = null;
```

create a new function `startCamHandler` to handle the webcam configurations.

"pages/index"

  const startCamHandler = async () => {
    console.log("Starting webcam and mic ..... ");
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    // console.log(model);

    //populate video element
    rawVideo.current.srcObject = localStream;
    video_in = rawVideo.current;
    rawVideo.current.addEventListener("loadeddata", (ev) => {
      console.log("loaded data.");
      transform();
    });

    mediaRecorder = new MediaRecorder(localStream, options);
    mediaRecorder.ondataavailable = (event) => {
      console.log("data-available");
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };
    mediaRecorder.start();
  };
```

When the above function fires, a user will receive a notification to allow webcam to open. The webcam view will be used to populate our DOM video element and once the data is loaded we use an event listener to fire the `transform` function. We shall also use a media recorder to load chuncks of recorded data and fill them in an array named `recordedChunks`.

The `transform` function will extract canvas context from our canvas DOM element and as well create another temporary canvas to use it when computing the frame we require. Once the `computeFrame` function is called,  it starts by drawing the current webcam video frame on it using draw image method then retrieve the pixel data using getImageData and assign it to the frame variable. We then use the current image data to call the segmentPersom method on the canvas to begin analyzation. Each pixel has 4 data, the RGB and the alpha or transparency data. This means each pixel needs 4 array spaces to make the final size 4 times the actual pixel number. We will have to loop through all the pixels  to check the RGB value and multiply each index by 4 then add an offset. We fail to add the offset to R beacuse its the first value for each pixel making its index 0. We then calculate the gray color for our view and set the new RGB color to gray if map value is not 1 for the current pixel in iteration. 


```
let transform = () => {
    c_out = processedVid.current;
    ctx_out = c_out.getContext("2d");

    c_tmp = document.createElement("canvas");
    c_tmp.setAttribute("width", 800);
    c_tmp.setAttribute("height", 450);

    ctx_tmp = c_tmp.getContext("2d");

    computeFrame();
  };

  let computeFrame = async () => {
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

    const { data: segmentation } = await model.segmentPerson(
      frame,
      segmentationConfig
    );

    // .then((segmentation) => {
    let output_img = ctx_out.getImageData(
      0,
      0,
      video_in.videoWidth,
      video_in.videoHeight
    );

    for (let i = 0; i < segmentation.length; i++) {
      // Extract data into r, g, b, a from imgData
      const [r, g, b, a] = [
        frame.data[i * 4],
        frame.data[i * 4 + 1],
        frame.data[i * 4 + 2],
        frame.data[i * 4 + 3],
      ];

      // Calculate the gray color
      const gray = 0.3 * r + 0.59 * g + 0.11 * b;

      // Set new RGB color to gray if map value is not 1
      // for the current pixel in iteration
      [
        output_img.data[i * 4],
        output_img.data[i * 4 + 1],
        output_img.data[i * 4 + 2],
        output_img.data[i * 4 + 3],
      ] = !segmentation[i] ? [gray, gray, gray, 255] : [r, g, b, a];
    }

    ctx_out.putImageData(output_img, 0, 0);
    setTimeout(computeFrame, 0);
  };
```

The above code should result in the gray scaled result. Your configured video should look like below:

{FINAL IMAGE SAMPLE}

Upon closing our webcam, we will have a code to stop the local strean  convert `recordedChunks` to a blob.The blob makes it easier to obtain a base64 format of the video through a file reader and pass the media file to the `uploadVideo` function which will be our final step.

```
"pages/index"

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

 const stopCamHandler = () => {
    console.log("Hanging up the call ...");
    localStream.getTracks().forEach((track) => track.stop());

    mediaRecorder.onstop = async (event) => {
      let blob = new Blob(recordedChunks, {
        type: "video/webm",
      });

      // Save original video to cloudinary
      await readFile(blob).then((encoded_file) => {
        uploadVideo(encoded_file);
      });

      videoDownloadRef.current.href = URL.createObjectURL(blob);
      videoDownloadRef.current.download =
        new Date().getTime() + "-locastream.webm";
    };
  };
```
The `uploadVideo` function whill upload the received media file to the back end through a POST method where it will be uploaded to cloudinary for online storage.

```
"pages/index"

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
```

At this point, we have succesfully created our frontend functions. Proceed by pasting the codes below to  fill in the necessary DOM elements in the return statement

```
 "pages/index"

 <div className="container">
      {model && (
        <>
          <div className="card">
            <div className="videos">
              <video
                className="display"
                width={800}
                height={450}
                ref={rawVideo}
                autoPlay
                playsInline
              ></video>
            </div>

            <canvas
              className="display"
              width={800}
              height={450}
              ref={processedVid}
            ></canvas>
          </div>
          <div className="buttons">
            <button className="button" onClick={startCamHandler} ref={startBtn}>
              Start Webcam
            </button>
            <button className="button" onClick={stopCamHandler} ref={closeBtn}>
              Close and upload original video
            </button>
            <button className="button">
              <a ref={videoDownloadRef} href={videoUrl}>
                Get Original video
              </a>
            </button>
          </div>
        </>
      )}
      {!model && <div>Loading machine learning models...</div>}
    </div>
```
The codes above will result in the DOM structure that looks as follows:

![Application UI](https://res.cloudinary.com/dogjmmett/image/upload/v1648275059/preview_d30fhl.png "Application UI").


We have successfuly created our grayscale webcam project. Ensure to go through the article to enjoy the experience.
