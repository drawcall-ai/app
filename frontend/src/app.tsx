import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RefObject, useEffect, useMemo, useRef, useState } from "react";
import { Container, Fullscreen, reversePainterSortStable } from "@pmndrs/uikit";
import { Environment, Grid, OrbitControls } from "@react-three/drei";
import { MeshTransmissionMaterial, useFBO } from "@pmndrs/vanilla";
import { Euler, Matrix4, NoToneMapping, Quaternion, Vector3 } from "three";
import { effect, signal } from "@preact/signals";
import {
  AppWindowIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MapIcon,
  MenuIcon,
  PlusIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { damp } from "three/src/math/MathUtils.js";
import { trpcReact } from "./TRPCProvider";
import { useQueryState } from "nuqs";
import { interpret } from "@pmndrs/uikitml";
import * as fontFamilies from "@pmndrs/msdfonts";
import { skipToken } from "@tanstack/react-query";

const materials: Array<MeshTransmissionMaterial> = [];

const fbo = useFBO(1024, 1024);

class GlassMaterial extends MeshTransmissionMaterial {
  constructor() {
    super({
      roughness: 0.0,
      thickness: 1.0,
      _transmission: 0.9,
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

export function App() {
  const [jobIdString, setJobId] = useQueryState("jobId");
  const [pageString, setPage] = useQueryState("page", { defaultValue: "1" });
  const page = parseInt(pageString);
  const jobId = jobIdString == null ? undefined : parseInt(jobIdString);
  const inputRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLDivElement>(null);
  const newRef = useRef<HTMLDivElement>(null);
  const drawerButtonRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const inputElementRef = useRef<HTMLInputElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const utils = trpcReact.useUtils();
  const [jobStatus, setJobStatus] = useState<
    "error" | "canceled" | "finished" | "running" | undefined
  >(undefined);
  trpcReact.jobs.status.useSubscription(
    jobId == null ? skipToken : { id: jobId },
    {
      onData: setJobStatus,
    }
  );
  useEffect(() => setJobStatus(undefined), [jobId]);
  const { data, isError, isLoading } = trpcReact.jobs.all.useQuery({
    page,
  });
  const { mutate: deleteJob } = trpcReact.jobs.delete.useMutation({
    onSuccess: (prompt, input) => {
      if (jobId === input.id) {
        setJobId(null);
        if (prompt != null && inputElementRef.current != null) {
          inputElementRef.current.value = prompt;
        }
      }
      utils.jobs.all.invalidate();
    },
    onError: () => {
      //TODO: send toast
    },
  });
  const { mutate: createJob } = trpcReact.uikit.create.useMutation({
    onSuccess: (data) => {
      setJobId(data.id.toString());
      if (inputElementRef.current != null) {
        inputElementRef.current.value = "";
      }
      utils.jobs.all.invalidate();
    },
    onError: () => {
      //TODO: send toast
    },
  });
  const isMobile = isTabletWidth();
  return (
    <>
      <Canvas
        onCreated={(state) => {
          state.gl.setTransparentSort(reversePainterSortStable);
        }}
        onClick={() => setDrawerOpen(false)}
        camera={{ position: [10, 10, 10] }}
        gl={{ localClippingEnabled: true }}
        className="absolute! inset-0 bg-[#333]"
      >
        <color args={["#333"]} attach="background" />
        <Camera />
        <Grid
          args={[10, 10]}
          fadeDistance={50}
          infiniteGrid
          sectionSize={2}
          sectionThickness={2}
          sectionColor={"#4c4c4c"}
          cellColor={"#5a5a5a"}
          cellThickness={0.7}
          fadeStrength={1}
        />
        <UserInterface
          inputRef={inputRef}
          cancelRef={cancelRef}
          drawerButtonRef={drawerButtonRef}
          drawerRef={drawerRef}
          newRef={newRef}
          promptOpen={jobId == null}
          drawerOpen={drawerOpen}
          cancelEnabled={jobStatus === "running"}
          isMobile={isMobile}
        />
        <Environment environmentIntensity={1.0} preset="studio" />
        <ambientLight intensity={0.8} />
        <directionalLight intensity={0.3} position={[-8, 10, 8]} />
        {jobId != null && <Result id={jobId} />}
      </Canvas>

      <div
        className="absolute flex flex-col gap-2 p-4 -translate-x-1/2 top-1/2 left-1/2 -translate-y-1/2 text-white font-[inter] font-medium"
        ref={drawerRef}
        style={{ transform: "scale(0)" }}
      >
        <span className="font-bold mx-4 mb-4 mt-2">Jobs</span>
        <div className="flex flex-col basis-0 overflow-y-auto overflow-x-hidden grow px-2">
        {data?.jobs.map(({ uikitJob, id }) => {
          const Icon = iconMap["uikit"];
          const isSelected = jobId === id;
          return (
            <button
              disabled={!drawerOpen}
              onClick={() => {
                setDrawerOpen(false);
                setJobId(id.toString());
              }}
              key={id}
              className={`cursor-pointer flex items-center gap-4 px-4 py-3 outline-0 rounded-lg transition-all hover:scale-[1.02] ${
                isSelected 
                  ? "bg-white/20 hover:bg-white/25 focus:bg-white/30" 
                  : "hover:bg-black/40 focus:bg-black/40"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm grow basis-0 min-w-0 text-ellipsis overflow-hidden text-nowrap">
                {uikitJob!.prompt}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteJob({ id });
                }}
                disabled={!drawerOpen}
                className="cursor-pointer rounded-full outline-0 transition-all p-2 bg-white/0 hover:bg-white/20 focus:bg-white/40 justify-self-end"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </button>
          );
        })}
        </div>
        {/* Pagination Controls */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mx-4 mt-4 pt-4 border-t border-white/20">
            <button
              disabled={!data.pagination.hasPrev || !drawerOpen}
              onClick={() => setPage((page - 1).toString())}
              className="cursor-pointer flex items-center gap-2 px-3 py-2 hover:bg-black/40 focus:bg-black/40 outline-0 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              <span className="text-sm">Prev</span>
            </button>
            
            <span className="text-sm text-white/70">
              Page {data.pagination.page} of {data.pagination.totalPages}
            </span>
            
            <button
              disabled={!data.pagination.hasNext || !drawerOpen}
              onClick={() => setPage((page + 1).toString())}
              className="cursor-pointer flex items-center gap-2 px-3 py-2 hover:bg-black/40 focus:bg-black/40 outline-0 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-sm">Next</span>
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div
        className="absolute flex flex-row justify-end -translate-x-1/2 top-1/2 left-1/2 -translate-y-1/2 p-[4px] text-white text-xl font-[inter] font-medium"
        ref={drawerButtonRef}
        style={{ transform: "scale(0)" }}
      >
        <button
          onClick={() => setDrawerOpen(!drawerOpen)}
          className="w-[48px] h-full flex justify-center outline-0 items-center cursor-pointer bg-black/0 hover:bg-black/20 focus:bg-black/40 hover:scale-100 scale-90 transition-all rounded-lg"
        >
          <MenuIcon className="w-7 h-7" />
        </button>
      </div>

      <div
        className="absolute -translate-x-1/2 top-1/2 left-1/2 -translate-y-1/2 p-[4px] text-white text-xl font-[inter] font-medium"
        ref={cancelRef}
        style={{ transform: "scale(0)" }}
      >
        <button
          disabled={jobId == null || jobStatus != "running"}
          onClick={() => jobId != null && deleteJob({ id: jobId })}
          className="w-full h-full flex justify-center outline-0 items-center cursor-pointer bg-black/0 hover:bg-black/20 focus:bg-black/40 hover:scale-100 scale-90 transition-all rounded-full"
        >
          <XIcon className="w-6 h-6" />
        </button>
      </div>

      <div
        className="absolute -translate-x-1/2 top-1/2 left-1/2 -translate-y-1/2 p-[4px] text-white text-xl font-[inter] font-medium"
        ref={newRef}
        style={{ transform: "scale(0)" }}
      >
        <button
          disabled={(isMobile && drawerOpen) || jobId == null}
          onClick={() => jobId != null && setJobId(null)}
          className="w-full h-full flex justify-center outline-0 items-center cursor-pointer bg-black/0 hover:bg-black/20 focus:bg-black/40 hover:scale-100 scale-90 transition-all rounded-full"
        >
          <PlusIcon className="w-7 h-7" />
        </button>
      </div>

      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-[4px] flex flex-row items-center text-white text-xl font-[inter] font-medium gap-6"
        ref={inputRef}
        style={{ transform: "scale(0)" }}
      >
        <SparklesIcon className="w-6 h-6 ml-6 shrink-0" />
        <input
          onKeyDown={(e) =>
            e.key === "Enter" &&
            inputElementRef.current != null &&
            inputElementRef.current.value.length > 0 &&
            createJob({ prompt: inputElementRef.current.value })
          }
          disabled={(isMobile && drawerOpen) || jobId != null}
          ref={inputElementRef}
          placeholder="Describe the 3D user interface"
          className="outline-0 grow shrink basis-0 min-w-0 text-ellipsis"
        ></input>
        <button
          disabled={(isMobile && drawerOpen) || jobId != null}
          onClick={() =>
            inputElementRef.current != null &&
            inputElementRef.current.value.length > 0 &&
            createJob({ prompt: inputElementRef.current.value })
          }
          className="bg-black/0 hover:bg-black/20 focus:bg-black/40 outline-0 outline-white/10 hover:scale-100 scale-90 transition-all rounded-full w-[56px] h-[56px] flex items-center justify-center cursor-pointer"
        >
          <ArrowUpIcon className="w-6 h-6 shrink-0" />
        </button>
      </div>
    </>
  );
}

const targetCameraPosition = new Vector3();
const targetCameraRotation = new Quaternion();
const normalizedHelper = new Vector3();

function Camera() {
  const camera = useThree((s) => s.camera);
  useFrame((_, delta) => {
    camera.position.lerp(targetCameraPosition, delta * 3);
    camera.quaternion.slerp(targetCameraRotation, delta * 3);
  });
  return null;
}

function Result({ id }: { id: number }) {
  const [stringData, setStringData] = useState("");
  useEffect(() => {
    setStringData("");
  }, [id]);
  useFrame(() => {
    targetCameraPosition.set(0, 8, 3);
    normalizedHelper.set(0, 0, 1).sub(targetCameraPosition).normalize();
    targetCameraRotation.setFromUnitVectors(negZAxis, normalizedHelper);
  });
  const { error, status } = trpcReact.uikit.output.useSubscription(
    {
      id,
    },
    {
      onData(data) {
        if (data != null) {
          setStringData((prev) => prev + data);
        }
      },
    }
  );

  const object = useMemo(() => {
    if (status != "idle" || stringData == null || stringData.length === 0) {
      return undefined;
    }
    const data = JSON.parse(stringData);
    // Use dynamic data if available, otherwise fall back to default content
    const uikitData = data.uikitmlJson;
    if (!uikitData) return null;

    const root = interpret({
      element: uikitData as any,
      classes: {},
    }) as any as Container;
    root.setProperties({
      fontFamilies,
      fontFamily: data.typography,
      "*": {
        renderOrder: 100,
      },
      renderOrder: 100,
    });
    return root;
  }, [stringData, status]);

  useFrame((_, delta) => {
    if (object) {
      object.update(delta * 1000);
    }
  });

  return (
    <group position-y={0.1} rotation-x={-Math.PI / 2}>
      {object && <primitive object={object}></primitive>}
    </group>
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

const eulerHelper = new Euler();
const vectorHelper = new Vector3();
const negZAxis = new Vector3(0, 0, -1);

function UserInterface({
  inputRef,
  newRef,
  cancelRef,
  promptOpen,
  drawerOpen,
  drawerButtonRef,
  drawerRef,
  cancelEnabled,
  isMobile,
}: {
  inputRef: RefObject<HTMLDivElement | null>;
  cancelRef: RefObject<HTMLDivElement | null>;
  newRef: RefObject<HTMLDivElement | null>;
  drawerButtonRef: RefObject<HTMLDivElement | null>;
  drawerRef: RefObject<HTMLDivElement | null>;
  promptOpen: boolean;
  drawerOpen: boolean;
  cancelEnabled: boolean;
  isMobile: boolean;
}) {
  const renderer = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const fullscreenRef = useRef<Fullscreen | undefined>(undefined);
  const drawerTranslateX = useSpringSignal(drawerOpen ? 0 : -280, 0.007);
  const drawerBackgroundOpacity = useSpringSignal(drawerOpen ? 1 : 0, 0.007);

  const promptTranslateY = useSpringSignal(
    drawerOpen && isMobile ? 160 : promptOpen ? 0 : 84,
    0.007
  );

  const cancelOpacity = useSpringSignal(
    cancelEnabled && !promptOpen ? 1 : 0,
    0.007
  );
  const buttonTranslateX = useSpringSignal(cancelEnabled ? 0 : 40, 0.007);
  const newOpacity = useSpringSignal(promptOpen ? 0 : 1, 0.007);
  const drawerButtonBackgroundOpacity = useSpringSignal(
    drawerOpen ? 0 : 1,
    0.007
  );

  useFrame((state, delta) => {
    if (promptOpen) {
      targetCameraPosition.set(0, 10, 10);
      targetCameraRotation.setFromUnitVectors(
        negZAxis,
        vectorHelper.copy(targetCameraPosition).negate().normalize()
      );
      eulerHelper.set(0, state.clock.getElapsedTime() * 0.05, 0, "YXZ");

      targetCameraPosition.applyEuler(eulerHelper);
      targetCameraRotation.premultiply(
        quaternionHelper.setFromEuler(eulerHelper)
      );
    }
    fullscreenRef.current?.update(delta * 1000);

    // Save defaults
    const oldTone = state.gl.toneMapping;

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
    const newElement = newRef.current;
    if (newElement == null) {
      return;
    }
    return effect(
      () => void (newElement.style.opacity = newOpacity.value.toString())
    );
  });
  useEffect(() => {
    const drawer = drawerRef.current;
    if (drawer == null) {
      return;
    }
    return effect(
      () =>
        void (drawer.style.opacity = drawerBackgroundOpacity.value.toString())
    );
  });
  useEffect(() => {
    const input = inputRef.current;
    const newBtn = newRef.current;
    const cancel = cancelRef.current;
    const drawerButton = drawerButtonRef.current;
    const drawer = drawerRef.current;
    if (
      input == null ||
      cancel == null ||
      drawerButton == null ||
      drawer == null ||
      newBtn == null
    ) {
      return;
    }
    const fullscreen = new Fullscreen(renderer, {
      "*": {
        depthWrite: true,
      },
    });
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
      backgroundColor: "#333",
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
    const buttonContainer = new Container({
      flexDirection: "row",
      gap: 16,
      transformTranslateX: buttonTranslateX,
    });
    promptContainer.add(buttonContainer);
    const newContainer = new Container({
      panelMaterialClass: GlassMaterial,
      width: 64,
      borderRadius: 32,
      borderWidth: 4,
      borderBend: 0.5,
      height: 64,
      backgroundColor: "#aaa",
      opacity: newOpacity,
      transformTranslateY: promptTranslateY,
    });
    buttonContainer.add(newContainer);
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
    buttonContainer.add(cancelContainer);
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
    const unsubscribeNew = syncToElement(newContainer, newBtn);
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
      unsubscribeNew();
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
