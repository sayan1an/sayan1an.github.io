#version 300 es

precision highp float;
    
#define PI 3.14159265359

in vec2 vertexTextureCoord; // from vertex shader
in vec3 vertexNormal; // normalize before use. from vertex-shader
in vec3 vertexPosition; // from vertex shader

uniform sampler2D uSampler;
uniform sampler2D uLightSampler; // Contain light positions

// from API
uniform mediump vec3 in_buffer[8]; // index 0,1,3 are color of light sources, 4 is camera position, 5 approx center of lights, 6 is (power, alpha, specularCoef), 7 is (#no sources, #samples, biased/unbiased).
    
out vec4 fragColor;

float ggxDist(const vec3 h, const vec3 n, float alpha) {
    float cosine_sq = dot(h, n);
    cosine_sq *= cosine_sq;
    float tan_sq = 1.0f / cosine_sq - 1.0f;
    float alpha_sq = alpha * alpha;

    tan_sq += alpha_sq;
    tan_sq *= tan_sq;
    float D = alpha_sq / (PI * cosine_sq * cosine_sq * tan_sq);

    return D;
}

float ggxG1(const vec3 v, const vec3 h, const vec3 n, float alpha) {
    float cosv_sq = dot(v, n);
    cosv_sq *= cosv_sq;
    float tanv_sq = 1.0f / cosv_sq - 1.0f;

    if (tanv_sq <= 1e-15)
        return 1.0f;
    else if (dot(h, v) <= 1e-15)
        return 0.0f;

    float alpha_sq = alpha * alpha;

    tanv_sq *= alpha_sq;
    tanv_sq += 1.0f;
    tanv_sq = 1.0f + sqrt(tanv_sq);

    return 2.0f/tanv_sq;
}

float ggxBrdf(const vec3 wo, const vec3 wi, const vec3 n, float alpha, float specularCoef) {
    vec3 h = normalize(wo + wi);
    
    float D = ggxDist(h, n, alpha);
    float G = ggxG1(wo, h, n, alpha) * ggxG1(wi, h, n, alpha);

    return (specularCoef * D * G) / (4.0f * dot(wi, n) * dot(wo, n)) + (1.0f - specularCoef) / PI;
}

highp float rand(vec2 co) {
    highp float a = 12.9898;
    highp float b = 78.233;
    highp float c = 43758.5453;
    highp float dt= dot(co.xy ,vec2(a,b));
    highp float sn= mod(dt,3.14);
    return fract(sin(sn) * c);
}

void main(void) {
    vec3 camPos = in_buffer[4];
    vec3 lightApproxPos = in_buffer[5];
    
    float power = in_buffer[6].r;
    float alpha = in_buffer[6].g;
    float specularCoef = in_buffer[6].b;

    float nLights = in_buffer[7].r;
    float samples = in_buffer[7].g;
    float isBiased = in_buffer[7].b;
   
    vec3 camDir = normalize(camPos - vertexPosition);
    vec3 _vertexNormal = normalize(vertexNormal);
    ivec2 lightTexSize = textureSize(uLightSampler, 0);
    float approxDistanceFromSourceSqInv = length(vertexPosition - lightApproxPos);
    approxDistanceFromSourceSqInv *= approxDistanceFromSourceSqInv;
    approxDistanceFromSourceSqInv = 1.0f/approxDistanceFromSourceSqInv;

    if (approxDistanceFromSourceSqInv * power > 0.0003)
    for (int j = 0; j < 3; j++) {
        for (int i = 0; i < int(samples) && i < 100; i++ ) {
            int k = j * int(nLights) + (isBiased > 0.5f ?  i *  int(nLights/samples) : int((rand(vertexPosition.xy + vec2(i,j)) + 1.0f) * nLights / 2.0f));
            vec3 lightPos = texelFetch(uLightSampler, ivec2((k % lightTexSize.x), lightTexSize.y - (k/lightTexSize.x) - 1), 0).rgb;
            vec3 lightDir = lightPos - vertexPosition;
            float distanceFromLight = length(lightDir);
            lightDir = normalize(lightDir);
            float cosThetaLight = dot(_vertexNormal, lightDir);
            fragColor = fragColor + power * float(nLights) * vec4(in_buffer[j], 1.0f) * 
                texture(uSampler, vec2(vertexTextureCoord.s, vertexTextureCoord.t)) * 
                cosThetaLight * ggxBrdf(camDir, lightDir, _vertexNormal, alpha, specularCoef) / (distanceFromLight * distanceFromLight);
        }
    }

    fragColor /= (samples * 3.0f); 
}