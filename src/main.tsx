import { PlaybackPlugin, type PluginViewProps } from "mo-sdk";
import { BiosignalsPluxView } from "./components/BiosignalspluxView";
import { BiosignalsPluxPreview } from "./components/BiosignalspluxPreview";

export default class BiosignalsPlayback extends PlaybackPlugin {
    getView(props: PluginViewProps) {
        return <BiosignalsPluxView {...props} />;
    }

    getPreview() {
        return <BiosignalsPluxPreview />;
    }

    validExtensions() {
        return ["json"];
    }
    //@ts-ignore
    validateCaptureDescriptor(descriptor: Record<string, unknown> | null): boolean {
        return true; 
    }
}