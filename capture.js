const puppeteer = require('puppeteer');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
const fs = require('fs');

async function recordWebsite(url, outputFileName) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    // Set the viewport size to capture the entire page
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate to the specified URL
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Scroll down to the bottom of the page
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const scrollInterval = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(scrollInterval);
            resolve();
          }
        }, 100);
      });
    });

    // Capture a screenshot for each frame to create the video
    const frames = [];
    const maxScrollHeight = await page.evaluate(() => document.body.scrollHeight);

    for (let scrollPosition = 0; scrollPosition < maxScrollHeight; scrollPosition += 500) {
      await page.evaluate((scrollPosition) => {
        window.scrollTo(0, scrollPosition);
      }, scrollPosition);

      const frame = await page.screenshot({ encoding: 'base64' });
      frames.push(frame);
      console.log('Captured frame:', frames.length);
    }

    // Save frames as individual image files
    const imagePaths = frames.map((frame, index) => {
      const imagePath = `./frame_${index + 1}.png`;
      fs.writeFileSync(imagePath, Buffer.from(frame, 'base64'));
      return imagePath;
    });

    // Save frames as a video using ffmpeg with adjusted frame rate
    const videoPath = `./${outputFileName}.mp4`;
    const frameRate = 15; // Adjust the frame rate as needed (e.g., 10 frames per second)

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(`concat:${imagePaths.join('|')}`)
        .outputOptions(`-r ${frameRate}`) // Set the frame rate
        .output(videoPath)
        .on('end', () => {
          // Remove individual image files after video creation
          imagePaths.forEach((imagePath) => fs.unlinkSync(imagePath));
          resolve();
        })
        .on('error', (err) => {
          reject(err);
        })
        .run();
    });

    console.log(`Video saved at: ${videoPath}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the browser
    await browser.close();
  }
}

// Example usage
const websiteURL = 'https://interactly.video';
const outputFileName = 'outputVideo';

recordWebsite(websiteURL, outputFileName);

