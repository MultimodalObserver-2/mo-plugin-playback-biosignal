import { useTranslation } from "mo-sdk";

export function BiosignalsPluxPreview() {
    //@ts-ignore
    const { t } = useTranslation("interaction-lab-biosignals-playback");
    return (
        <div style={{
            padding: "20px",
            textAlign: "center",
            background: "#f9f9f9",
            border: "1px solid #ccc",
            borderRadius: "4px"
        }}>
            <h3 style={{color: "#333"}}>BiosignalsPlux</h3>
            <div style={{fontSize: "3rem", marginTop: "10px"}}>📈</div>
        </div>
    );
}