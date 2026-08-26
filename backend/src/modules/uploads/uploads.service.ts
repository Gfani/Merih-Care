import { Injectable } from "@nestjs/common";

@Injectable()
export class UploadsService {
  async handleUpload(fileName: string, fileBuffer: Buffer): Promise<any> {
    console.log(`Uploaded file: ${fileName} (${fileBuffer.length} bytes)`);
    return {
      url: `https://api.merihcare.et/uploads/${Date.now()}-${fileName}`,
      fileName,
    };
  }
}
