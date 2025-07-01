import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RefObject, useEffect, useMemo, useRef, useState } from "react";
import { Container, Fullscreen, reversePainterSortStable } from "@pmndrs/uikit";
import { Environment, Grid, OrbitControls } from "@react-three/drei";
import {
  MeshDiscardMaterial,
  MeshTransmissionMaterial,
  useFBO,
} from "@pmndrs/vanilla";
import {
  Color,
  Euler,
  Matrix4,
  NoToneMapping,
  Quaternion,
  Side,
  Texture,
  ToneMapping,
  Vector3,
} from "three";
import { effect, signal } from "@preact/signals";
import {
  AppWindowIcon,
  ArrowUpIcon,
  MapIcon,
  MenuIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { damp } from "three/src/math/MathUtils.js";

const materials: Array<MeshTransmissionMaterial> = [];

const fbo = useFBO(1024, 1024);

class GlassMaterial extends MeshTransmissionMaterial {
  constructor() {
    super({
      roughness: 0.0,
      thickness: 0.1,
      _transmission: 1.0,
      chromaticAberration: 0.002,
      buffer: fbo.texture as any,
    });
    this.reflectivity = 0.1;
    this.metalness = 0.01;
    materials.push(this);
  }

  dispose(): void {
    super.dispose();
    const i = materials.indexOf(this);
    if (i != -1) {
      materials.splice(i, 1);
    }
  }
}

const iconMap = {
  uikit: AppWindowIcon,
  map: MapIcon,
};

const list = [
  {
    name: "uikit job",
    type: "uikit",
  },
  {
    name: "map job",
    type: "map",
  },
  {
    name: "uikit job",
    type: "uikit",
  },
];

export function App() {
  const inputRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLDivElement>(null);
  const drawerButtonRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const [promptOpen, setPromptOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <>
      <Canvas
        onCreated={(state) => {
          state.gl.setTransparentSort(reversePainterSortStable);
        }}
        camera={{ position: [10, 10, 10] }}
        gl={{ localClippingEnabled: true }}
        className="absolute! inset-0"
      >
        <color args={["#333"]} attach="background" />
        <Grid
          args={[10, 10]}
          fadeDistance={50}
          sectionSize={2}
          cellColor={"#555"}
          infiniteGrid
          followCamera
          cellThickness={1}
          sectionThickness={1.5}
          sectionColor={"#555"}
          fadeStrength={1}
        />
        <UserInterface
          inputRef={inputRef}
          cancelRef={cancelRef}
          drawerButtonRef={drawerButtonRef}
          drawerRef={drawerRef}
          promptOpen={promptOpen}
          drawerOpen={drawerOpen}
        />
        <Environment preset="city" />
      </Canvas>

      <div
        className="absolute flex flex-col gap-2 p-4 -translate-x-1/2 top-1/2 left-1/2 -translate-y-1/2 text-white font-[inter] font-medium"
        ref={drawerRef}
      >
        <span className="font-bold mx-4 mb-4 mt-2">Requests</span>
        {list.map(({ name, type }) => {
          const Icon = iconMap[type as keyof typeof iconMap];
          return (
            <div className="flex items-center gap-4 px-4 py-3  hover:bg-black/10 rounded-lg cursor-pointer transition-all hover:scale-[1.02]">
              <Icon className="w-5 h-5" />
              <span className="text-sm">{name}</span>
            </div>
          );
        })}
      </div>

      <div
        className="absolute flex flex-row justify-end -translate-x-1/2 top-1/2 left-1/2 -translate-y-1/2 p-[4px] text-white text-xl font-[inter] font-medium"
        ref={drawerButtonRef}
      >
        <button
          onClick={() => setDrawerOpen(!drawerOpen)}
          className="w-[48px] h-full flex justify-center outline-0 items-center cursor-pointer bg-black/0 hover:bg-black/20 hover:scale-100 scale-90 transition-all rounded-lg"
        >
          <MenuIcon className="w-7 h-7" />
        </button>
      </div>

      <div
        className="absolute -translate-x-1/2 top-1/2 left-1/2 -translate-y-1/2 p-[4px] text-white text-xl font-[inter] font-medium"
        ref={cancelRef}
      >
        <button
          disabled={promptOpen}
          onClick={() => setPromptOpen(true)}
          className="w-full h-full flex justify-center outline-0 items-center cursor-pointer bg-black/0 hover:bg-black/20 focus:bg-black/40 hover:scale-100 scale-90 transition-all rounded-full"
        >
          <XIcon className="w-6 h-6" />
        </button>
      </div>

      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-[4px] flex flex-row items-center text-white text-xl font-[inter] font-medium gap-6"
        ref={inputRef}
      >
        <SparklesIcon className="w-6 h-6 ml-6 shrink-0" />
        <input
          disabled={!promptOpen}
          placeholder="Describe the 3D user interface"
          className="outline-0 grow shrink basis-0 min-w-0 text-ellipsis"
        ></input>
        <button
          disabled={!promptOpen}
          onClick={() => setPromptOpen(false)}
          className="bg-black/0 hover:bg-black/20 focus:bg-black/40 outline-0 outline-white/10 hover:scale-100 scale-90 transition-all rounded-full w-[56px] h-[56px] flex items-center justify-center cursor-pointer"
        >
          <ArrowUpIcon className="w-6 h-6 shrink-0" />
        </button>
      </div>
    </>
  );
}

function useSpringSignal(target: number, lambda: number) {
  const result = useMemo(() => signal(target), []);
  useFrame((_, delta) => {
    const current = result.peek();
    if (Math.abs(current - target) < 0.001) {
      return;
    }
    result.value = damp(current, target, lambda, delta * 1000);
  });
  return result;
}

const center = new Vector3();
const eulerHelper = new Euler();

function UserInterface({
  inputRef,
  cancelRef,
  promptOpen,
  drawerOpen,
  drawerButtonRef,
  drawerRef,
}: {
  inputRef: RefObject<HTMLDivElement | null>;
  cancelRef: RefObject<HTMLDivElement | null>;
  drawerButtonRef: RefObject<HTMLDivElement | null>;
  drawerRef: RefObject<HTMLDivElement | null>;
  promptOpen: boolean;
  drawerOpen: boolean;
}) {
  const renderer = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const fullscreenRef = useRef<Fullscreen | undefined>(undefined);
  const drawerTranslateX = useSpringSignal(drawerOpen ? 0 : -280, 0.007);
  const drawerBackgroundOpacity = useSpringSignal(drawerOpen ? 1 : 0, 0.007);

  const isMobile = isTabletWidth();
  const promptTranslateY = useSpringSignal(
    drawerOpen && isMobile ? 160 : promptOpen ? 0 : 84,
    0.007
  );

  const cancelOpacity = useSpringSignal(promptOpen ? 0 : 1, 0.007);
  const drawerButtonBackgroundOpacity = useSpringSignal(
    drawerOpen ? 0 : 1,
    0.007
  );

  useFrame((state, delta) => {
    camera.rotation.order = "YXZ";
    camera.position
      .set(10, 10, 10)
      .applyEuler(eulerHelper.set(0, state.clock.getElapsedTime() * 0.05, 0));
    camera.lookAt(center);
    fullscreenRef.current?.update(delta * 1000);

    let oldBg: Color | Texture | null;
    let oldTone: ToneMapping;
    let oldSides: Array<Side>;

    // Save defaults
    oldTone = state.gl.toneMapping;
    oldBg = state.scene.background;
    oldSides = materials.map((material) => material.side);

    for (const meshTransmissionMaterial of materials) {
      (meshTransmissionMaterial as any).time = state.clock.getElapsedTime();
    }
    state.gl.toneMapping = NoToneMapping;

    if (fullscreenRef.current != null) {
      fullscreenRef.current.visible = false;
    }

    // Render into the main buffer
    state.gl.setRenderTarget(fbo);
    state.gl.render(state.scene, state.camera);

    if (fullscreenRef.current != null) {
      fullscreenRef.current.visible = true;
    }

    for (let i = 0; i < materials.length; i++) {
      const material = materials[i]!;
      material.side = oldSides[i]!;
    }

    state.scene.background = oldBg;
    state.gl.setRenderTarget(null);
    state.gl.toneMapping = oldTone;
  });
  useEffect(() => {
    const cancel = cancelRef.current;
    if (cancel == null) {
      return;
    }
    return effect(
      () => void (cancel.style.opacity = cancelOpacity.value.toString())
    );
  });
  useEffect(() => {
    const input = inputRef.current;
    const cancel = cancelRef.current;
    const drawerButton = drawerButtonRef.current;
    const drawer = drawerRef.current;
    if (
      input == null ||
      cancel == null ||
      drawerButton == null ||
      drawer == null
    ) {
      return;
    }
    const fullscreen = new Fullscreen(renderer);
    const promptContainer = new Container({
      height: "100%",
      maxWidth: 640,
      width: "100%",
      marginX: "auto",
      padding: 16,
      gap: 16,
      flexDirection: "column",
      justifyContent: "flex-end",
      alignItems: "center",
    });
    fullscreen.add(promptContainer);
    const drawerWrapperContainer = new Container({
      positionType: "absolute",
      transformTranslateX: drawerTranslateX,
      inset: 16,
      flexDirection: "row",
      alignItems: "flex-start",
    });
    fullscreen.add(drawerWrapperContainer);
    const drawerContainer = new Container({
      positionType: "relative",
      width: "100%",
      height: "100%",
      maxWidth: 320,
    });
    drawerWrapperContainer.add(drawerContainer);
    const drawerBackgroundContainer = new Container({
      panelMaterialClass: GlassMaterial,
      width: "100%",
      height: "100%",
      borderRadius: 16,
      borderWidth: 4,
      borderBend: 0.5,
      opacity: drawerBackgroundOpacity,
      backgroundColor: "#aaa",
    });
    drawerContainer.add(drawerBackgroundContainer);
    const drawerButtonContainer = new Container({
      positionType: "absolute",
      zIndexOffset: 100,
      positionTop: 8,
      positionRight: 8,
      panelMaterialClass: GlassMaterial,
      opacity: drawerButtonBackgroundOpacity,
      width: 128,
      borderRadius: 16,
      borderWidth: 4,
      borderBend: 0.5,
      height: 48,
      backgroundColor: "#aaa",
    });
    drawerContainer.add(drawerButtonContainer);
    const cancelContainer = new Container({
      panelMaterialClass: GlassMaterial,
      width: 64,
      borderRadius: 32,
      borderWidth: 4,
      borderBend: 0.5,
      height: 64,
      backgroundColor: "#aaa",
      opacity: cancelOpacity,
      transformTranslateY: promptTranslateY,
    });
    promptContainer.add(cancelContainer);
    const inputContainer = new Container({
      panelMaterialClass: GlassMaterial,
      width: "100%",
      borderRadius: 32,
      borderWidth: 4,
      borderBend: 0.5,
      height: 64,
      backgroundColor: "#aaa",
      transformTranslateY: promptTranslateY,
    });
    const unsubscribeInput = syncToElement(inputContainer, input);
    const unsubscribeCancel = syncToElement(cancelContainer, cancel);
    const unsubscribeDrawerButton = syncToElement(
      drawerButtonContainer,
      drawerButton
    );
    const unsubscribeDrawer = syncToElement(drawerContainer, drawer);
    promptContainer.add(inputContainer);
    fullscreenRef.current = fullscreen;
    camera.add(fullscreen);
    return () => {
      camera.remove(fullscreen);
      unsubscribeInput();
      unsubscribeCancel();
      unsubscribeDrawerButton();
      unsubscribeDrawer();
    };
  }, [renderer, camera, promptTranslateY]);
  return <primitive object={camera} />;
}

function toPixel(value: number) {
  return `${value}px`;
}

const matrixHelper = new Matrix4();
const quaternionHelper = new Quaternion();

function syncToElement(from: Container, to: HTMLElement) {
  return effect(() => {
    const { globalMatrix, properties, size } = from;

    const translation = new Vector3();
    const scale = new Vector3();
    const rotation = new Euler();

    const { value } = globalMatrix;
    if (value != null) {
      matrixHelper.copy(value);
      matrixHelper.decompose(translation, quaternionHelper, scale);
      rotation.setFromQuaternion(quaternionHelper);
    }
    const width = scale.x * (size.value?.[0] ?? 0);
    to.style.width = toPixel(width);
    const height = scale.y * (size.value?.[1] ?? 0);
    to.style.height = toPixel(height);

    const transformTranslateX = translation.x / properties.value.pixelSize;
    const transformTranslateY = -translation.y / properties.value.pixelSize;
    const transformTranslateZ = translation.z / properties.value.pixelSize;

    const transformScaleZ = scale.z;
    const transformRotateX = rotation.x;
    const transformRotateZ = rotation.y;
    const transformRotateY = rotation.z;

    to.style.transform = `translate3d(${transformTranslateX}px, ${transformTranslateY}px, ${transformTranslateZ}px) rotate3d(${transformRotateX}, ${transformRotateY}, ${transformRotateZ}, 1rad) scaleZ(${transformScaleZ})`;
  });
}

function isTabletWidth() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1260);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  return isMobile;
}
