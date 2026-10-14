#!/usr/bin/env python3
"""
LoRA fine-tuning entrypoint.

STATUS: this script is complete and ready to run, but has NOT been
executed yet as of this submission (see docs/PRD.md milestone M3 and
dissertation Chapter 4, which reports no fine-tuned-model results for
exactly this reason). Running it is the next concrete project step.

Usage:
    python train_lora.py --config configs/lora_config.yaml
"""
import argparse
import json
import os

import yaml
import torch
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling,
)
from peft import LoraConfig, get_peft_model


def format_example(tokenizer, record: dict) -> str:
    messages = [
        {"role": "system", "content": "You are RAGA, an assistant for Hindustani classical music."},
        {"role": "user", "content": record["instruction"]},
        {"role": "assistant", "content": record["output"]},
    ]
    return tokenizer.apply_chat_template(messages, tokenize=False)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    args = ap.parse_args()

    with open(args.config) as f:
        cfg = yaml.safe_load(f)

    torch.manual_seed(cfg["training"]["seed"])

    tokenizer = AutoTokenizer.from_pretrained(cfg["base_model"])
    model = AutoModelForCausalLM.from_pretrained(
        cfg["base_model"],
        torch_dtype=torch.float16,
        device_map="auto",
    )

    lora_cfg = LoraConfig(
        r=cfg["lora"]["r"],
        lora_alpha=cfg["lora"]["alpha"],
        lora_dropout=cfg["lora"]["dropout"],
        target_modules=cfg["lora"]["target_modules"],
        bias=cfg["lora"]["bias"],
        task_type=cfg["lora"]["task_type"],
    )
    model = get_peft_model(model, lora_cfg)
    model.print_trainable_parameters()

    train_ds = load_dataset("json", data_files=cfg["training"]["train_file"])["train"]
    val_ds = load_dataset("json", data_files=cfg["training"]["val_file"])["train"]

    def tokenize_fn(batch):
        texts = [format_example(tokenizer, r) for r in [dict(zip(batch.keys(), v)) for v in zip(*batch.values())]]
        return tokenizer(texts, truncation=True, max_length=1024, padding="max_length")

    train_ds = train_ds.map(tokenize_fn, batched=True, remove_columns=train_ds.column_names)
    val_ds = val_ds.map(tokenize_fn, batched=True, remove_columns=val_ds.column_names)

    collator = DataCollatorForLanguageModeling(tokenizer, mlm=False)

    training_args = TrainingArguments(
        output_dir=cfg["training"]["output_dir"],
        learning_rate=cfg["training"]["learning_rate"],
        num_train_epochs=cfg["training"]["num_train_epochs"],
        per_device_train_batch_size=cfg["training"]["per_device_train_batch_size"],
        gradient_accumulation_steps=cfg["training"]["gradient_accumulation_steps"],
        warmup_ratio=cfg["training"]["warmup_ratio"],
        logging_steps=cfg["training"]["logging_steps"],
        eval_steps=cfg["training"]["eval_steps"],
        save_strategy=cfg["training"]["save_strategy"],
        evaluation_strategy="steps",
        fp16=True,
        seed=cfg["training"]["seed"],
        report_to="none",
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        data_collator=collator,
    )

    trainer.train()
    model.save_pretrained(cfg["training"]["output_dir"])

    manifest = {
        "base_model": cfg["base_model"],
        "lora_config": cfg["lora"],
        "seed": cfg["training"]["seed"],
        "train_file": cfg["training"]["train_file"],
    }
    with open(os.path.join(cfg["training"]["output_dir"], "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"Adapter saved to {cfg['training']['output_dir']}")


if __name__ == "__main__":
    main()
