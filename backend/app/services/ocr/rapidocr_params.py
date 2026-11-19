"""RapidOCR model selection, shared by the image build (download) and the runtime.

Standalone on purpose (no application import): the Dockerfile copies this single
file before the application code to download the models in their own cached layer.
"""


def rapidocr_params(model_dir: str) -> dict:
    from rapidocr import LangRec, ModelType, OCRVersion

    return {
        "Global.model_root_dir": model_dir,
        "Global.use_cls": False,
        "Det.ocr_version": OCRVersion.PPOCRV5,
        "Det.model_type": ModelType.MOBILE,
        "Rec.ocr_version": OCRVersion.PPOCRV5,
        "Rec.lang_type": LangRec.LATIN,
        "Rec.model_type": ModelType.MOBILE,
    }


def download_models(model_dir: str) -> None:
    """Fetch the detector and the latin recognizer into ``model_dir`` (build time only).

    RapidOCR loads each model lazily on first use, and the recognizer only runs when the
    detector finds text: the warm-up image therefore carries a line of text.
    """
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont
    from rapidocr import RapidOCR

    image = Image.new("RGB", (900, 200), "white")
    ImageDraw.Draw(image).text(
        (40, 60), "Bonjour 2025", fill="black", font=ImageFont.load_default(size=80)
    )
    RapidOCR(params=rapidocr_params(model_dir))(np.array(image))
