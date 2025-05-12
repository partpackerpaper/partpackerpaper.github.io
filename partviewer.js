// credits to https://github.com/VAST-AI-Research/HoloPart/tree/page/modules/SceneViewer

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// implementation
class ViewerModule {
  constructor(container, modelBaseNames, modelPath, imagePath) {
    this.container = container;
    this.modelBaseNames = modelBaseNames;
    this.modelPath = modelPath;
    this.imagePath = imagePath;
    this.imageExtension = ".jpg";
    this.modelExtension = ".glb";
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.model = null;
    this.controls = null;
    // model stats
    this.model_bbox = null;
    this.model_center = null;
    this.closest_part = null;
    this.closest_part_bbox = null;
    this.closest_part_center = null;
    // for auto-explode
    this.explodeAmount = 0;
    this.explodeDirection = 1;
  }

  init() {
    this.setupScene();
    this.createImageSlider();
    this.loadModel(this.modelBaseNames[0]);
  }

  setupScene() {
    const viewerContainer = document.querySelector(
      `${this.container} #viewer-container`
    );
    const width = viewerContainer.clientWidth;
    const height = viewerContainer.clientHeight;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
    this.camera.position.set(0, 1, 5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0xffffff);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.physicallyCorrectLights = true;
    viewerContainer.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(
      this.camera,
      this.renderer.domElement
    );
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.25;

    // auto rotate camera
    // this.controls.autoRotate = true;
    // this.controls.autoRotateSpeed = 5;

    // Default light
    const hemisphereLight = new THREE.HemisphereLight(0xcccccc, 0x333333, 6);
    this.scene.add(hemisphereLight);

    // Increase point light intensity
    // const lightIntensity = 50;
    // const lightDistance = 100;

    // const directions = [
    //   [10, 0, 0], // +x
    //   [-10, 0, 0], // -x
    //   [0, 10, 0], // +y
    //   [0, -10, 0], // -y
    //   [0, 0, 10], // +z
    //   [0, 0, -10], // -z
    // ];

    // directions.forEach((dir, index) => {
    //   const pointLight = new THREE.PointLight(
    //     0xffffff,
    //     lightIntensity,
    //     lightDistance
    //   );
    //   pointLight.position.set(...dir);
    //   pointLight.castShadow = true;
    //   this.scene.add(pointLight);

    //   pointLight.name = `PointLight_${index}`;
    // });

    window.addEventListener("resize", () => {
      const newWidth = viewerContainer.clientWidth;
      const newHeight = viewerContainer.clientHeight;
      this.renderer.setSize(newWidth, newHeight);
      this.camera.aspect = newWidth / newHeight;
      this.camera.updateProjectionMatrix();
    });

    this.animate();
  }

  loadModel(baseName, index) {
    
    if (this.model) this.scene.remove(this.model);

    const overlay = document.querySelector(
      `${this.container} #loading-overlay`
    );
    overlay.style.display = "flex";

    const loader = new GLTFLoader();
    loader.load(
      `${this.modelPath}/${baseName}${this.modelExtension}`,
      (gltf) => {
        this.model = gltf.scene;
        this.scene.add(this.model);

        this.model.traverse((child) => {
          if (child.isMesh) child.visible = true;
        });

        this.adjustModelMaterial();

        // model stats
        this.model_bbox = new THREE.Box3().setFromObject(this.model);
        this.model_center = this.model_bbox.getCenter(new THREE.Vector3());
        let closest_distance = Infinity;
        let closest_part = null;
        this.model.traverse((child) => {
          if (child.isMesh) {
            const bbox = new THREE.Box3().setFromObject(child);
            const part_center = bbox.getCenter(new THREE.Vector3());
            const distance = part_center.distanceTo(this.model_center);
            if (distance < closest_distance) {
              closest_distance = distance;
              closest_part = child;
            }
          }
        });
        this.closest_part = closest_part;
        this.closest_part_bbox = new THREE.Box3().setFromObject(this.closest_part);
        this.closest_part_center = this.closest_part_bbox.getCenter(new THREE.Vector3());

        // Reset camera based on model size
        this.camera.position.set(0, 1 + this.model_center.y, 8 + this.model_center.z);

        // Replace buttons with explode slider
        this.createExplodeSlider();

        overlay.style.display = "none";
      }
    );
  }

  adjustModelMaterial() {
    if (this.model) {
      this.model.traverse((child) => {
        if (child.isMesh) {
          // adjust material to make it look better.
          child.material.metalness = 0.2;
          child.material.roughness = 1.0;
        }
      });
    }
  }

  createImageSlider() {
    const sliderContainer = document.querySelector(
      `${this.container} #image-slider`
    );
    this.modelBaseNames.forEach((baseName, index) => {
      const slide = document.createElement("div");
      slide.classList.add("swiper-slide");
      
      const img = document.createElement("img");
      img.src = `${this.imagePath}/${baseName}${this.imageExtension}`;
      img.alt = `Model ${index + 1}`;
      img.onclick = () => this.loadModel(baseName, index);

      slide.appendChild(img);
      sliderContainer.appendChild(slide);
    });

    this.swiper = new Swiper(`${this.container} .swiper`, {
      slidesPerView: "auto",
      slidesPerGroup: 2,
      spaceBetween: 5,
      rewind: true,
      navigation: {
        nextEl: `${this.container} .swiper-button-next`,
        prevEl: `${this.container} .swiper-button-prev`,
      },
    });
  }

  createExplodeSlider() {
    const controlsDiv = document.querySelector(
      `${this.container} #button-block`
    );
    controlsDiv.innerHTML = ""; // Clear existing buttons

    const sliderContainer = document.createElement("div");
    sliderContainer.style.display = "flex";
    sliderContainer.style.alignItems = "center";
    sliderContainer.style.justifyContent = "center";
    sliderContainer.style.margin = "10px";

    const label = document.createElement("span");
    label.textContent = "Explode: ";
    label.style.marginRight = "10px";
    label.style.fontWeight = "bold"; // Make the label bold

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "1";
    slider.step = "0.01";
    slider.value = "0";
    slider.style.width = "300px";

    slider.oninput = (event) => {
      const explodeAmount = parseFloat(event.target.value);
      this.applyExplodeEffect(explodeAmount);
    };

    sliderContainer.appendChild(label);
    sliderContainer.appendChild(slider);
    controlsDiv.appendChild(sliderContainer);
  }

  applyExplodeEffect(explodeAmount) {
    if (!this.model) return;

    

    this.model.traverse((part) => {
      if (part.isMesh) {
        if (part === this.closest_part) return;
        const bbox = new THREE.Box3().setFromObject(part);
        const part_center = bbox.getCenter(new THREE.Vector3());
        const direction = part_center.clone().sub(this.closest_part_center).normalize();

        // Calculate the new position based on the explode amount
        const originalPosition = new THREE.Vector3().copy(part.userData.originalPosition || part.position);
        const offset = direction.multiplyScalar(explodeAmount * 2);
        const newPosition = originalPosition.clone().add(offset);

        // Store the original position if not already stored
        if (!part.userData.originalPosition) {
          part.userData.originalPosition = originalPosition.clone();
        }

        part.position.copy(newPosition);
      }
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    // auto-explode
    // if (this.model) {
    //   this.explodeAmount += 0.002 * this.explodeDirection;
    //   if (this.explodeAmount >= 0.3) {
    //     this.explodeDirection = -1;
    //   } else if (this.explodeAmount <= 0) {
    //     this.explodeDirection = 1;
    //   }
    //   this.applyExplodeEffect(this.explodeAmount);
    // }
  }
}

// initialize the viewer
// need to manully fill in the model and image paths...
const viewer = new ViewerModule(
  ".partviewer",
  [
    "pillow_ok",
    "barrel",
    "chair",
    "chair2",
    "color_bus",
    "cyan_car",
    "house",
    "mechcrab",
    "plant",
    "playground",
    "wooden_chest",
    "wooden_roy_horse",
    "mushroom",
    "redarmour",
    "snowman",
    "spongebob",
    "warhammer"
  ],
  "assets/models",
  "assets/images"
);
viewer.init();